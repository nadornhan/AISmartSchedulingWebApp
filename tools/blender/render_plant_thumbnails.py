"""Render transparent 2D thumbnails from every runtime CHRONO plant GLB."""

from __future__ import annotations

from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = ROOT / "assets" / "3d" / "chrono-plants"
MAPLE_ROOT = ROOT / "frontend" / "web" / "public" / "models" / "plants" / "chrono-maple"
OUTPUT_ROOT = ROOT / "frontend" / "web" / "public" / "images" / "plants"
STAGES = ("seedling", "growing", "mature")
SOURCES = {
    "oak": SOURCE_ROOT / "oak",
    "maple": MAPLE_ROOT,
    "pine": SOURCE_ROOT / "pine",
    "cherry_blossom": SOURCE_ROOT / "cherry-blossom",
    "bonsai": SOURCE_ROOT / "bonsai",
    "willow": SOURCE_ROOT / "willow",
    "lavender": SOURCE_ROOT / "lavender",
    "sunflower": SOURCE_ROOT / "sunflower",
    "chrono": SOURCE_ROOT / "chrono",
}


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(collection):
            collection.remove(datablock)


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def render_thumbnail(species: str, source: Path, stage: str) -> None:
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(source / f"{stage}.glb"))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[i] for point in corners) for i in range(3)))
    maximum = Vector(tuple(max(point[i] for point in corners) for i in range(3)))
    center = (minimum + maximum) / 2
    extent = maximum - minimum

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(extent.x, extent.z) * 1.25
    distance = max(extent.length * 2.2, 6)
    camera.location = center + Vector((distance * 0.42, -distance, distance * 0.28))
    look_at(camera, center + Vector((0, 0, extent.z * 0.03)))
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=center + Vector((-3.5, -4.5, 7)))
    key = bpy.context.object
    key.data.energy = 1050
    key.data.size = 5
    look_at(key, center)
    bpy.ops.object.light_add(type="AREA", location=center + Vector((4, 1.5, 4)))
    fill = bpy.context.object
    fill.data.energy = 650
    fill.data.color = (0.18, 0.95, 0.82)
    fill.data.size = 4
    look_at(fill, center)

    scene = bpy.context.scene
    scene.world.color = (0.008, 0.012, 0.025)
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    destination = OUTPUT_ROOT / species
    destination.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(destination / f"{stage}.png")
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    for plant_species, source_dir in SOURCES.items():
        for growth_stage in STAGES:
            render_thumbnail(plant_species, source_dir, growth_stage)
    print(f"Rendered plant thumbnails to {OUTPUT_ROOT}")
