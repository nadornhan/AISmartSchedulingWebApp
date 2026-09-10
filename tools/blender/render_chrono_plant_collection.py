"""Render a three-stage approval sheet for each draft CHRONO plant family."""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
ASSET_ROOT = ROOT / "assets" / "3d" / "chrono-plants"
SPECIES = ("oak", "pine", "cherry-blossom", "bonsai", "willow", "lavender", "sunflower")
STAGES = ("seedling", "growing", "mature")
STAGE_SCALES = {"seedling": 0.58, "growing": 0.78, "mature": 1.0}


def clear() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def simple_material(name: str, color: tuple[float, float, float, float], *, emission: float = 0.0) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.88
    if emission:
        emission_color = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        emission_strength = bsdf.inputs.get("Emission Strength")
        if emission_color: emission_color.default_value = color
        if emission_strength: emission_strength.default_value = emission
    return mat


def import_stage(species: str, stage: str, x: float) -> None:
    previous = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ASSET_ROOT / species / f"{stage}.glb"))
    imported = set(bpy.context.scene.objects) - previous
    top_level = [obj for obj in imported if obj.parent not in imported]
    container = bpy.data.objects.new(f"Preview_{species}_{stage}", None)
    bpy.context.collection.objects.link(container)
    container.location.x = x
    container.scale = (STAGE_SCALES[stage],) * 3
    for obj in top_level:
        obj.parent = container


def add_label(text: str, x: float) -> None:
    bpy.ops.object.text_add(location=(x, -0.32, 0.04), rotation=(math.radians(72), 0, 0))
    label = bpy.context.object
    label.name = f"Label_{text}"
    label.data.body = text
    label.data.align_x = "CENTER"
    label.data.size = 0.28
    label.data.extrude = 0.004
    label.data.materials.append(simple_material(f"Label_{text}_Material", (0.55, 1.0, 0.88, 1.0), emission=1.0))


def render_sheet(species: str, output_dir: Path) -> None:
    clear()
    positions = (-2.6, 0.0, 2.9)
    for stage, x in zip(STAGES, positions):
        import_stage(species, stage, x)

    bpy.ops.mesh.primitive_plane_add(size=18, location=(0, 0, -0.025))
    ground = bpy.context.object
    ground.data.materials.append(simple_material("Preview_Ground", (0.025, 0.095, 0.105, 1.0)))

    compact = species in {"bonsai", "lavender", "sunflower"}
    camera_location = (7.2, -12.5, 5.8) if compact else (8.5, -15.5, 7.2)
    camera_target = (0.2, 0, 1.25 if compact else 1.55)
    bpy.ops.object.camera_add(location=camera_location)
    camera = bpy.context.object
    camera.data.lens = 58
    look_at(camera, camera_target)
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(4.5, -5.0, 8.5))
    key = bpy.context.object
    key.data.energy = 1250
    key.data.shape = "DISK"
    key.data.size = 6
    look_at(key, (0, 0, 1.4))

    bpy.ops.object.light_add(type="AREA", location=(-4.5, 1.8, 5.5))
    fill = bpy.context.object
    fill.data.energy = 760
    fill.data.color = (0.18, 0.95, 0.7)
    fill.data.size = 5
    look_at(fill, (0, 0, 1.3))

    world = bpy.context.scene.world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.006, 0.018, 0.045, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.3

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 650
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(output_dir / f"chrono-{species}-stages.png")
    scene.view_settings.look = "AgX - Medium High Contrast"
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    import math

    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    destination = Path(args[0]) if args else Path(tempfile.gettempdir()) / "chrono-plant-collection-preview"
    destination.mkdir(parents=True, exist_ok=True)
    for plant_species in SPECIES:
        render_sheet(plant_species, destination)
    print(f"Rendered collection previews to {destination}")

