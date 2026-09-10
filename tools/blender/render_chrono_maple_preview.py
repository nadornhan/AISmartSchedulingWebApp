"""Render square previews for the generated CHRONO Maple Blender sources.

Usage:
    blender --background --python tools/blender/render_chrono_maple_preview.py -- OUTPUT_DIRECTORY
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "frontend" / "web" / "public" / "models" / "plants" / "chrono-maple"


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def preview_material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.9
    return mat


def render(stage: str, output_dir: Path) -> None:
    bpy.ops.wm.open_mainfile(filepath=str(ASSET_DIR / f"{stage}.blend"))

    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.015))
    ground = bpy.context.object
    ground.name = "Preview_Ground"
    ground.data.materials.append(preview_material("Preview_Ground", (0.035, 0.11, 0.12, 1.0)))

    camera_settings = {
        "seedling": ((2.8, -4.4, 2.4), (0, 0, 0.72)),
        "growing": ((4.1, -6.2, 3.3), (0, 0, 1.25)),
        "mature": ((5.1, -7.6, 4.1), (0, 0, 1.55)),
    }
    location, target = camera_settings[stage]
    bpy.ops.object.camera_add(location=location)
    camera = bpy.context.object
    camera.data.lens = 55
    look_at(camera, target)
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(3.5, -3.8, 7))
    key = bpy.context.object
    key.data.energy = 1000
    key.data.shape = "DISK"
    key.data.size = 5
    look_at(key, (0, 0, 1.2))

    bpy.ops.object.light_add(type="AREA", location=(-4, 1.5, 4))
    fill = bpy.context.object
    fill.data.energy = 650
    fill.data.color = (0.2, 0.9, 0.72)
    fill.data.size = 4
    look_at(fill, (0, 0, 1.2))

    world = bpy.context.scene.world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.008, 0.025, 0.055, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(output_dir / f"chrono-maple-{stage}.png")
    scene.view_settings.look = "AgX - Medium High Contrast"
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    destination = Path(arguments[0]) if arguments else Path(tempfile.gettempdir()) / "chrono-maple-preview"
    destination.mkdir(parents=True, exist_ok=True)
    for growth_stage in ("seedling", "growing", "mature"):
        render(growth_stage, destination)
    print(f"Rendered previews to {destination}")
