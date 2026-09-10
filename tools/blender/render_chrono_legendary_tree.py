"""Render approval and hero previews for the CHRONO legendary tree."""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "assets" / "3d" / "chrono-plants" / "chrono"
STAGES = ("seedling", "growing", "mature")


def clear() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def preview_material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.86
    return mat


def import_model(stage: str, position: tuple[float, float, float], scale: float) -> None:
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ASSET_DIR / f"{stage}.glb"))
    imported = set(bpy.context.scene.objects) - before
    top_level = [obj for obj in imported if obj.parent not in imported]
    container = bpy.data.objects.new(f"Preview_Chrono_{stage}", None)
    bpy.context.collection.objects.link(container)
    container.location = position
    container.scale = (scale,) * 3
    for obj in top_level:
        obj.parent = container


def setup_scene(camera_location: tuple[float, float, float], target: tuple[float, float, float]) -> None:
    bpy.ops.mesh.primitive_plane_add(size=28, location=(0, 0, -0.025))
    ground = bpy.context.object
    ground.data.materials.append(preview_material("Legendary_Ground", (0.012, 0.045, 0.075, 1.0)))

    bpy.ops.object.camera_add(location=camera_location)
    camera = bpy.context.object
    camera.data.lens = 58
    look_at(camera, target)
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(5.5, -6.5, 11))
    key = bpy.context.object
    key.data.energy = 1450
    key.data.shape = "DISK"
    key.data.size = 7
    look_at(key, target)

    bpy.ops.object.light_add(type="AREA", location=(-6, 2.2, 7))
    fill = bpy.context.object
    fill.data.energy = 1050
    fill.data.color = (0.22, 0.7, 1.0)
    fill.data.size = 6
    look_at(fill, target)

    bpy.ops.object.light_add(type="POINT", location=(0, -1.4, 2.6))
    core_light = bpy.context.object
    core_light.data.energy = 380
    core_light.data.color = (0.2, 1.0, 0.78)

    world = bpy.context.scene.world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.003, 0.008, 0.035, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.22


def configure_render(path: Path, width: int, height: int) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(path)
    scene.view_settings.look = "AgX - Medium High Contrast"
    bpy.ops.render.render(write_still=True)


def render_growth_sheet(output_dir: Path) -> None:
    clear()
    import_model("seedling", (-4.2, 0, 0), 0.62)
    import_model("growing", (-1.35, 0, 0), 0.78)
    import_model("mature", (3.6, 0, 0), 1.0)
    setup_scene((13.5, -24, 11.5), (1.0, 0, 2.5))
    configure_render(output_dir / "chrono-legendary-tree-stages.png", 1300, 760)


def render_hero(output_dir: Path) -> None:
    clear()
    import_model("mature", (0, 0, 0), 1.0)
    setup_scene((10.5, -18.5, 8.2), (0, 0, 2.65))
    configure_render(output_dir / "chrono-legendary-tree-hero.png", 900, 900)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    destination = Path(args[0]) if args else Path(tempfile.gettempdir()) / "chrono-legendary-tree-preview"
    destination.mkdir(parents=True, exist_ok=True)
    render_growth_sheet(destination)
    render_hero(destination)
    print(f"Rendered legendary CHRONO tree previews to {destination}")

