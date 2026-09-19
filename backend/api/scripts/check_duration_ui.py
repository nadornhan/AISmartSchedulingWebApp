"""Optional browser smoke test against disposable API/web instances.

Requires: pip install playwright && playwright install --with-deps chromium
Example (Docker test network):
  python scripts/check_duration_ui.py --web-url http://web:3000 --api-url http://api:8000
Creates a synthetic user and task. Do not run against production.
"""

import argparse
import json
from uuid import uuid4

import httpx
from playwright.sync_api import expect, sync_playwright


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--web-url", default="http://localhost:3000")
    parser.add_argument("--api-url", default="http://localhost:8000")
    parser.add_argument("--screenshot", default="/tmp/duration-preview.png")
    args = parser.parse_args()
    title = f"Duration browser test {uuid4().hex[:8]}"
    password = uuid4().hex + "A1!"
    email = f"duration-browser-{uuid4()}@example.com"
    api = httpx.Client(base_url=args.api_url, timeout=30)
    registered = api.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Duration",
            "last_name": "Test",
            "role": "student",
        },
    )
    registered.raise_for_status()
    login = api.post("/auth/login", json={"email": email, "password": password})
    login.raise_for_status()
    token = login.json()["access_token"]
    api.headers["Authorization"] = f"Bearer {token}"
    task = api.post("/tasks", json={"title": title}).json()
    task_id = task["id"]
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 1000})
        page.on("pageerror", lambda error: print("Browser error:", error, flush=True))
        page.on(
            "requestfailed",
            lambda request: print("Request failed:", request.url, request.failure, flush=True),
        )
        page.set_default_timeout(30000)
        page.add_init_script(f"localStorage.setItem('chrono_access_token', {json.dumps(token)})")

        # Preserve real API payloads/auth while resolving the web's configured localhost
        # URL inside a container network. No responses are mocked.
        def forward(route):
            url = route.request.url
            path = "/" + url.split("/", 3)[3] if len(url.split("/", 3)) == 4 else "/"
            response = route.fetch(url=args.api_url + path)
            route.fulfill(
                response=response,
                headers={**response.headers, "access-control-allow-origin": args.web_url},
            )

        page.route("http://localhost:8011/**", forward)
        page.route("http://localhost:8000/**", forward)
        page.goto(args.web_url + "/tasks", wait_until="domcontentloaded", timeout=120000)
        try:
            page.get_by_role("button", name=f"Edit {title}", exact=True).click(timeout=60000)
        except Exception:
            page.screenshot(path=args.screenshot, full_page=True)
            print("Page:", page.url, page.locator("body").inner_text()[:3000], flush=True)
            raise
        panel = page.get_by_role("region", name="Duration estimate")
        panel.get_by_role("button", name="Estimate time", exact=True).click()
        expect(panel.get_by_label("Minutes to apply")).to_be_visible()
        assert api.get(f"/tasks/{task_id}").json()["estimated_duration_minutes"] is None
        suggested = int(panel.get_by_label("Minutes to apply").input_value())
        page.screenshot(path=args.screenshot, full_page=True)
        panel.get_by_role("button", name="Apply duration", exact=True).click()
        expect(panel.get_by_role("status")).to_contain_text(f"Saved {suggested} minutes")
        assert api.get(f"/tasks/{task_id}").json()["estimated_duration_minutes"] == suggested
        # Applying updates local form state; a second preview must remain available.
        panel.get_by_role("button", name="Estimate time", exact=True).click()
        panel.get_by_label("Minutes to apply").fill("90")
        panel.get_by_role("button", name="Apply duration", exact=True).click()
        expect(panel.get_by_role("status")).to_contain_text("Saved 90 minutes")
        assert api.get(f"/tasks/{task_id}").json()["estimated_duration_minutes"] == 90
        panel.get_by_role("button", name="Estimate time", exact=True).click()
        panel.get_by_role("button", name="Dismiss", exact=True).click()
        expect(panel.get_by_role("status")).to_contain_text("dismissed")
        assert api.get(f"/tasks/{task_id}").json()["estimated_duration_minutes"] == 90
        # Lose the first response after the backend commits an ignored decision.
        # Retry must preserve ignored, even if the editable minutes are invalid.
        panel.get_by_role("button", name="Estimate time", exact=True).click()
        panel.get_by_label("Minutes to apply").fill("0")

        def lose_response(route):
            response = route.fetch(url=f"{args.api_url}/tasks/{task_id}/duration/confirm")
            assert response.status == 200
            route.abort("failed")

        confirmation_url = f"**/tasks/{task_id}/duration/confirm"
        page.route(confirmation_url, lose_response, times=1)
        panel.get_by_role("button", name="Dismiss", exact=True).click()
        panel.get_by_role("button", name="Retry saving choice", exact=True).click()
        expect(panel.get_by_role("status")).to_contain_text("dismissed")
        assert api.get(f"/tasks/{task_id}").json()["estimated_duration_minutes"] == 90
        # Dirty form protection and mobile layout.
        page.locator('input[name="title"]').fill(title + " changed")
        expect(panel.get_by_role("button", name="Estimate time", exact=True)).to_be_disabled()
        page.set_viewport_size({"width": 390, "height": 844})
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        browser.close()
    api.delete(f"/tasks/{task_id}").raise_for_status()
    print(
        "PASS: real preview, accepted, changed, ignored, lost-response retry, dirty-form protection, mobile width"
    )


if __name__ == "__main__":
    main()
