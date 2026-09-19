"""Generate the original CHRONO Maple growth-stage GLB assets.

Run with Blender in background mode:

    blender --background --python tools/blender/generate_chrono_maple.py

The assets are deterministic, texture-free low-poly models designed for the
React Three Fiber personal forest. Blender converts its Z-up coordinates to
glTF's Y-up coordinates during export.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "frontend" / "web" / "public" / "models" / "plants" / "chrono-maple"

COLORS = {
    "bark": (0.20, 0.075, 0.025, 1.0),
    "bark_light": (0.38, 0.15, 0.045, 1.0),
    "leaf_green": (0.05, 0.42, 0.20, 1.0),
    "leaf_light": (0.16, 0.66, 0.31, 1.0),
    "leaf_orange": (0.95, 0.24, 0.035, 1.0),
    "leaf_gold": (1.0, 0.52, 0.04, 1.0),
    "leaf_red": (0.66, 0.035, 0.025, 1.0),
    "chrono": (0.0, 0.92, 0.68, 1.0),
    "chrono_core": (0.23, 1.0, 0.82, 1.0),
}


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def material(name: str, color: tuple[float, float, float, float], *, emission: float = 0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.78
    if emission:
        emission_color = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        emission_strength = bsdf.inputs.get("Emission Strength")
        if emission_color:
            emission_color.default_value = color
        if emission_strength:
            emission_strength.default_value = emission
    return mat


def assign(obj: bpy.types.Object, mat: bpy.types.Material) -> bpy.types.Object:
    obj.data.materials.append(mat)
    for polygon in getattr(obj.data, "polygons", []):
        polygon.use_smooth = False
    return obj


def tapered_segment(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    start_radius: float,
    end_radius: float,
    mat: bpy.types.Material,
    vertices: int = 7,
) -> bpy.types.Object:
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=start_radius,
        radius2=end_radius,
        depth=direction.length,
        location=(start_vector + end_vector) / 2,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    return assign(obj, mat)


def leaf_cluster(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    return assign(obj, mat)


def chrono_ring(radius: float, height: float, mat: bpy.types.Material) -> None:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=radius,
        minor_radius=max(0.012, radius * 0.035),
        major_segments=24,
        minor_segments=5,
        location=(0.0, 0.0, height),
    )
    ring = assign(bpy.context.object, mat)
    ring.name = "Chrono_Energy_Ring"

    for index in range(4):
        angle = index * math.pi / 2
        x = math.cos(angle) * radius
        y = math.sin(angle) * radius
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=radius * 0.075, location=(x, y, height))
        marker = assign(bpy.context.object, mat)
        marker.name = f"Chrono_Hour_Marker_{index + 1:02d}"


def energy_path(points: list[tuple[float, float, float]], mat: bpy.types.Material, name: str) -> None:
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 1
    curve.bevel_depth = 0.018
    curve.bevel_resolution = 0
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1.0)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)


def add_roots(size: float, bark: bpy.types.Material, energy: bpy.types.Material) -> None:
    for index in range(6):
        angle = index * math.tau / 6
        start = (math.cos(angle) * size * 0.08, math.sin(angle) * size * 0.08, size * 0.08)
        end = (math.cos(angle) * size * 0.48, math.sin(angle) * size * 0.48, 0.025)
        tapered_segment(f"Root_{index + 1:02d}", start, end, size * 0.075, 0.012, bark, 6)
        if index % 2 == 0:
            energy_path(
                [
                    (start[0] * 0.7, start[1] * 0.7, start[2] + 0.012),
                    ((start[0] + end[0]) * 0.55, (start[1] + end[1]) * 0.55, size * 0.055),
                    (end[0] * 0.92, end[1] * 0.92, 0.045),
                ],
                energy,
                f"Root_Energy_{index + 1:02d}",
            )


def build_seedling(materials: dict[str, bpy.types.Material]) -> None:
    bark = materials["bark_light"]
    green = materials["leaf_light"]
    dark_green = materials["leaf_green"]
    chrono = materials["chrono"]

    tapered_segment("Young_Stem", (0, 0, 0.02), (0.02, 0, 1.25), 0.09, 0.035, bark, 6)
    tapered_segment("Left_Stem", (0.0, 0, 0.7), (-0.32, 0.02, 1.0), 0.035, 0.015, bark, 5)
    tapered_segment("Right_Stem", (0.01, 0, 0.84), (0.3, -0.03, 1.12), 0.03, 0.012, bark, 5)
    leaf_cluster("Leaf_Left", (-0.42, 0.02, 1.05), (0.28, 0.1, 0.16), dark_green, (0, 0.35, -0.45))
    leaf_cluster("Leaf_Right", (0.4, -0.03, 1.17), (0.3, 0.11, 0.17), green, (0, -0.4, 0.45))
    leaf_cluster("Leaf_Top", (0.04, 0, 1.36), (0.24, 0.18, 0.26), green)
    add_roots(0.58, bark, chrono)
    chrono_ring(0.36, 0.11, chrono)


def build_growing(materials: dict[str, bpy.types.Material]) -> None:
    bark = materials["bark"]
    bark_light = materials["bark_light"]
    green = materials["leaf_green"]
    light = materials["leaf_light"]
    chrono = materials["chrono"]

    tapered_segment("Trunk_Lower", (0, 0, 0.03), (0.05, 0, 1.25), 0.19, 0.12, bark, 7)
    tapered_segment("Trunk_Upper", (0.05, 0, 1.18), (-0.03, 0.02, 1.82), 0.13, 0.065, bark_light, 7)
    branches = [
        ((0.03, 0, 1.14), (-0.7, 0.03, 1.68)),
        ((0.02, 0, 1.34), (0.67, -0.05, 1.82)),
        ((-0.01, 0.01, 1.53), (0.04, 0.6, 2.0)),
    ]
    for index, (start, end) in enumerate(branches):
        tapered_segment(f"Branch_{index + 1:02d}", start, end, 0.075, 0.025, bark_light, 6)

    clusters = [
        ((-0.72, 0.03, 1.83), (0.58, 0.48, 0.5), green),
        ((0.69, -0.05, 1.94), (0.6, 0.5, 0.54), light),
        ((0.03, 0.53, 2.08), (0.55, 0.48, 0.48), green),
        ((0.0, -0.06, 2.2), (0.7, 0.58, 0.62), light),
    ]
    for index, (position, scale, mat) in enumerate(clusters):
        leaf_cluster(f"Canopy_{index + 1:02d}", position, scale, mat, (0.1 * index, 0.2, 0.2 * index))

    add_roots(0.82, bark, chrono)
    chrono_ring(0.49, 0.14, chrono)
    energy_path([(0.08, 0.18, 0.18), (-0.08, 0.18, 0.62), (0.08, 0.13, 1.02)], chrono, "Trunk_Energy")


def build_mature(materials: dict[str, bpy.types.Material]) -> None:
    bark = materials["bark"]
    bark_light = materials["bark_light"]
    orange = materials["leaf_orange"]
    gold = materials["leaf_gold"]
    red = materials["leaf_red"]
    chrono = materials["chrono_core"]

    tapered_segment("Trunk_Base", (0, 0, 0.03), (0.08, 0.01, 1.45), 0.32, 0.21, bark, 8)
    tapered_segment("Trunk_Crown", (0.08, 0.01, 1.35), (-0.03, 0.03, 2.18), 0.22, 0.09, bark_light, 7)
    branches = [
        ((0.04, 0.0, 1.25), (-1.05, 0.12, 2.02)),
        ((0.08, 0.0, 1.4), (1.05, -0.12, 2.13)),
        ((0.02, 0.02, 1.58), (-0.72, -0.78, 2.32)),
        ((0.03, 0.02, 1.68), (0.7, 0.72, 2.4)),
        ((0.0, 0.03, 1.92), (-0.1, 0.12, 2.67)),
    ]
    for index, (start, end) in enumerate(branches):
        tapered_segment(f"Crown_Branch_{index + 1:02d}", start, end, 0.12, 0.035, bark_light, 7)

    clusters = [
        ((-1.08, 0.12, 2.18), (0.86, 0.68, 0.66), red),
        ((1.1, -0.12, 2.28), (0.88, 0.7, 0.68), orange),
        ((-0.72, -0.77, 2.5), (0.78, 0.67, 0.68), orange),
        ((0.72, 0.72, 2.58), (0.76, 0.68, 0.66), gold),
        ((-0.08, 0.08, 2.78), (1.0, 0.82, 0.78), orange),
        ((0.0, -0.42, 2.48), (0.82, 0.72, 0.64), red),
    ]
    for index, (position, scale, mat) in enumerate(clusters):
        leaf_cluster(f"Autumn_Canopy_{index + 1:02d}", position, scale, mat, (0.13 * index, 0.1, 0.3 * index))

    add_roots(1.15, bark, chrono)
    chrono_ring(0.66, 0.17, chrono)
    energy_path(
        [
            (0.1, 0.29, 0.19),
            (-0.11, 0.27, 0.58),
            (0.14, 0.22, 0.96),
            (-0.08, 0.18, 1.35),
            (0.11, 0.13, 1.7),
        ],
        chrono,
        "Chrono_Trunk_Vein",
    )


def export_stage(stage: str) -> None:
    reset_scene()
    materials = {
        name: material(
            f"Chrono_{name.title()}",
            color,
            emission=3.0 if name in {"chrono", "chrono_core"} else 0.0,
        )
        for name, color in COLORS.items()
    }
    builders = {
        "seedling": build_seedling,
        "growing": build_growing,
        "mature": build_mature,
    }
    builders[stage](materials)

    root = bpy.data.objects.new(f"Chrono_Maple_{stage.title()}", None)
    bpy.context.collection.objects.link(root)
    for obj in list(bpy.context.collection.objects):
        if obj is not root and obj.parent is None:
            obj.parent = root

    root["asset_author"] = "CHRONO team"
    root["asset_family"] = "Chrono Maple"
    root["growth_stage"] = stage
    root["generated_by"] = "tools/blender/generate_chrono_maple.py"

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output = OUTPUT_DIR / f"{stage}.glb"
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_DIR / f"{stage}.blend"), check_existing=False)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_apply=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )
    print(f"Exported {output}")


if __name__ == "__main__":
    for growth_stage in ("seedling", "growing", "mature"):
        export_stage(growth_stage)

