"""Generate the remaining original CHRONO low-poly plant collection.

The generated draft assets live outside the web runtime until their visual
direction is approved. Run from the repository root with Blender 5.2+:

    blender --background --python tools/blender/generate_chrono_plant_collection.py
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))

from generate_chrono_maple import (
    chrono_ring,
    energy_path,
    leaf_cluster,
    material,
    reset_scene,
    tapered_segment,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_ROOT = ROOT / "assets" / "3d" / "chrono-plants"
STAGES = ("seedling", "growing", "mature")

CHRONO = (0.0, 0.92, 0.68, 1.0)
CHRONO_CORE = (0.25, 1.0, 0.84, 1.0)


PALETTES = {
    "oak": {
        "bark": (0.24, 0.09, 0.025, 1.0),
        "bark_light": (0.43, 0.19, 0.055, 1.0),
        "primary": (0.055, 0.34, 0.13, 1.0),
        "secondary": (0.12, 0.52, 0.22, 1.0),
        "accent": (0.37, 0.68, 0.21, 1.0),
    },
    "pine": {
        "bark": (0.19, 0.075, 0.028, 1.0),
        "bark_light": (0.36, 0.16, 0.055, 1.0),
        "primary": (0.025, 0.24, 0.16, 1.0),
        "secondary": (0.04, 0.39, 0.23, 1.0),
        "accent": (0.08, 0.58, 0.32, 1.0),
    },
    "cherry-blossom": {
        "bark": (0.25, 0.10, 0.075, 1.0),
        "bark_light": (0.48, 0.25, 0.19, 1.0),
        "primary": (0.95, 0.38, 0.58, 1.0),
        "secondary": (1.0, 0.62, 0.74, 1.0),
        "accent": (1.0, 0.82, 0.87, 1.0),
    },
    "bonsai": {
        "bark": (0.20, 0.075, 0.025, 1.0),
        "bark_light": (0.42, 0.18, 0.05, 1.0),
        "primary": (0.04, 0.29, 0.12, 1.0),
        "secondary": (0.08, 0.48, 0.19, 1.0),
        "accent": (0.22, 0.64, 0.25, 1.0),
    },
    "willow": {
        "bark": (0.26, 0.13, 0.035, 1.0),
        "bark_light": (0.48, 0.28, 0.075, 1.0),
        "primary": (0.16, 0.40, 0.10, 1.0),
        "secondary": (0.32, 0.62, 0.14, 1.0),
        "accent": (0.57, 0.78, 0.24, 1.0),
    },
    "lavender": {
        "bark": (0.10, 0.31, 0.12, 1.0),
        "bark_light": (0.20, 0.48, 0.18, 1.0),
        "primary": (0.33, 0.16, 0.64, 1.0),
        "secondary": (0.52, 0.29, 0.84, 1.0),
        "accent": (0.72, 0.52, 1.0, 1.0),
    },
    "sunflower": {
        "bark": (0.08, 0.32, 0.10, 1.0),
        "bark_light": (0.16, 0.52, 0.14, 1.0),
        "primary": (1.0, 0.50, 0.015, 1.0),
        "secondary": (1.0, 0.75, 0.04, 1.0),
        "accent": (1.0, 0.92, 0.23, 1.0),
    },
}


def make_materials(species: str) -> dict[str, bpy.types.Material]:
    palette = PALETTES[species]
    result = {
        key: material(f"Chrono_{species}_{key}", color)
        for key, color in palette.items()
    }
    result["chrono"] = material(f"Chrono_{species}_energy", CHRONO, emission=2.6)
    result["chrono_core"] = material(f"Chrono_{species}_core", CHRONO_CORE, emission=3.4)
    result["soil"] = material(f"Chrono_{species}_soil", (0.16, 0.065, 0.018, 1.0))
    result["pot"] = material(f"Chrono_{species}_pot", (0.055, 0.17, 0.18, 1.0))
    result["dark"] = material(f"Chrono_{species}_dark", (0.12, 0.045, 0.012, 1.0))
    return result


def cone(
    name: str,
    radius: float,
    depth: float,
    z: float,
    mat: bpy.types.Material,
    *,
    top_radius: float = 0.0,
    vertices: int = 8,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius,
        radius2=top_radius,
        depth=depth,
        location=(0, 0, z),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    return obj


def cube(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    return obj


def roots(radius: float, mat: bpy.types.Material, energy: bpy.types.Material, count: int = 6) -> None:
    for index in range(count):
        angle = index * math.tau / count
        end = (math.cos(angle) * radius, math.sin(angle) * radius, 0.025)
        tapered_segment(
            f"Root_{index + 1:02d}",
            (0, 0, 0.10),
            end,
            radius * 0.10,
            0.012,
            mat,
            6,
        )
    energy_path([(0.0, radius * 0.12, 0.1), (0.07, radius * 0.1, 0.42), (-0.04, radius * 0.08, 0.75)], energy, "Root_Energy")


def broadleaf_trunk(
    stage: str,
    mats: dict[str, bpy.types.Material],
    *,
    twist: float = 0.0,
) -> tuple[float, list[tuple[float, float, float]]]:
    if stage == "seedling":
        tapered_segment("Young_Trunk", (0, 0, 0.02), (0.03, 0, 1.25), 0.095, 0.035, mats["bark_light"], 6)
        endpoints = [(-0.35, 0.02, 1.05), (0.36, -0.03, 1.18)]
        starts = [(0.01, 0, 0.72), (0.02, 0, 0.85)]
        radius = 0.46
    elif stage == "growing":
        tapered_segment("Trunk_Lower", (0, 0, 0.02), (0.05, 0, 1.42), 0.20, 0.115, mats["bark"], 7)
        tapered_segment("Trunk_Upper", (0.05, 0, 1.34), (-0.03 + twist, 0.03, 1.95), 0.12, 0.05, mats["bark_light"], 7)
        endpoints = [(-0.78, 0.08, 1.78), (0.75, -0.08, 1.9), (0.08, 0.62, 2.08)]
        starts = [(0.03, 0, 1.15), (0.04, 0, 1.32), (0.0, 0.02, 1.52)]
        radius = 0.76
    else:
        tapered_segment("Trunk_Base", (0, 0, 0.02), (0.08, 0.01, 1.62), 0.34, 0.21, mats["bark"], 8)
        tapered_segment("Trunk_Crown", (0.08, 0.01, 1.50), (-0.04 + twist, 0.04, 2.32), 0.22, 0.075, mats["bark_light"], 7)
        endpoints = [
            (-1.12, 0.12, 2.1),
            (1.12, -0.1, 2.22),
            (-0.78, -0.82, 2.42),
            (0.78, 0.78, 2.52),
            (-0.05, 0.08, 2.78),
        ]
        starts = [(0.04, 0, 1.32), (0.07, 0, 1.42), (0.02, 0, 1.65), (0.02, 0.02, 1.75), (0, 0.03, 1.98)]
        radius = 1.06
    for index, (start, end) in enumerate(zip(starts, endpoints)):
        tapered_segment(f"Branch_{index + 1:02d}", start, end, 0.095 if stage == "mature" else 0.065, 0.02, mats["bark_light"], 6)
    return radius, endpoints


def build_oak(stage: str, mats: dict[str, bpy.types.Material]) -> None:
    radius, endpoints = broadleaf_trunk(stage, mats)
    if stage == "seedling":
        clusters = [((-0.4, 0.02, 1.12), (0.3, 0.18, 0.22)), ((0.4, -0.03, 1.24), (0.32, 0.2, 0.24)), ((0.02, 0, 1.42), (0.3, 0.25, 0.3))]
    elif stage == "growing":
        clusters = [((*endpoints[0][:2], 1.9), (0.68, 0.56, 0.55)), ((*endpoints[1][:2], 2.02), (0.7, 0.58, 0.56)), ((0.05, 0.48, 2.2), (0.66, 0.55, 0.52)), ((0, -0.05, 2.3), (0.78, 0.66, 0.62))]
    else:
        clusters = [
            ((-1.12, 0.12, 2.3), (0.9, 0.75, 0.72)), ((1.12, -0.1, 2.4), (0.92, 0.75, 0.75)),
            ((-0.78, -0.8, 2.58), (0.86, 0.72, 0.7)), ((0.78, 0.76, 2.65), (0.85, 0.72, 0.7)),
            ((-0.05, 0.08, 2.95), (1.05, 0.88, 0.82)), ((0, -0.35, 2.68), (0.9, 0.76, 0.72)),
        ]
    leaf_mats = [mats["primary"], mats["secondary"], mats["accent"]]
    for index, (position, scale) in enumerate(clusters):
        leaf_cluster(f"Oak_Canopy_{index + 1:02d}", position, scale, leaf_mats[index % len(leaf_mats)], (0.1 * index, 0.2, 0.24 * index))
    if stage == "mature":
        for index, (x, y, z) in enumerate([(-0.65, -0.6, 2.15), (0.52, -0.68, 2.3), (0.16, 0.62, 2.38)]):
            leaf_cluster(f"Acorn_{index + 1:02d}", (x, y, z), (0.07, 0.07, 0.11), mats["dark"])
    roots(radius, mats["bark"], mats["chrono_core"])
    chrono_ring(radius * 0.58, 0.14, mats["chrono_core"])


def build_pine(stage: str, mats: dict[str, bpy.types.Material]) -> None:
    heights = {"seedling": 1.45, "growing": 2.35, "mature": 3.35}
    height = heights[stage]
    tapered_segment("Pine_Trunk", (0, 0, 0.02), (0, 0, height), 0.11 + height * 0.045, 0.035, mats["bark"], 7)
    tiers = {"seedling": 2, "growing": 4, "mature": 6}[stage]
    for index in range(tiers):
        fraction = index / max(1, tiers - 1)
        z = 0.65 + fraction * (height - 0.55)
        radius = (0.5 + (1 - fraction) * 0.42) * (height / 3.35 + 0.45)
        depth = 0.62 + (1 - fraction) * 0.42
        cone(f"Needle_Tier_{index + 1:02d}", radius, depth, z, mats["primary"] if index % 2 == 0 else mats["secondary"], vertices=9)
    if stage == "mature":
        for index, angle in enumerate((0.2, 2.2, 4.2)):
            leaf_cluster(f"Pine_Cone_{index + 1:02d}", (math.cos(angle) * 0.55, math.sin(angle) * 0.55, 1.55 + index * 0.32), (0.09, 0.09, 0.16), mats["bark_light"])
    roots(0.55 + height * 0.16, mats["bark"], mats["chrono"])
    chrono_ring(0.32 + height * 0.1, 0.12, mats["chrono"])


def build_cherry_blossom(stage: str, mats: dict[str, bpy.types.Material]) -> None:
    radius, endpoints = broadleaf_trunk(stage, mats, twist=0.08)
    if stage == "seedling":
        clusters = [((-0.38, 0.02, 1.13), (0.28, 0.18, 0.2)), ((0.4, -0.02, 1.25), (0.3, 0.2, 0.22)), ((0.04, 0, 1.44), (0.28, 0.23, 0.26))]
    elif stage == "growing":
        clusters = [((-0.78, 0.08, 1.9), (0.62, 0.5, 0.5)), ((0.75, -0.08, 2.0), (0.64, 0.52, 0.52)), ((0.06, 0.56, 2.16), (0.58, 0.48, 0.48)), ((0.0, -0.05, 2.3), (0.72, 0.6, 0.58))]
    else:
        clusters = [
            ((-1.12, 0.12, 2.28), (0.82, 0.67, 0.66)), ((1.12, -0.1, 2.38), (0.86, 0.7, 0.68)),
            ((-0.78, -0.8, 2.55), (0.8, 0.68, 0.66)), ((0.78, 0.76, 2.64), (0.8, 0.67, 0.66)),
            ((-0.04, 0.08, 2.94), (1.0, 0.82, 0.78)), ((0.0, -0.36, 2.66), (0.82, 0.7, 0.66)),
        ]
    blossom_mats = [mats["primary"], mats["secondary"], mats["accent"]]
    for index, (position, scale) in enumerate(clusters):
        leaf_cluster(f"Blossom_Cloud_{index + 1:02d}", position, scale, blossom_mats[index % 3], (0.12 * index, 0.15, 0.25 * index))
    if stage == "mature":
        for index, position in enumerate([(-1.2, -0.42, 1.7), (-0.35, -0.92, 2.0), (0.75, -0.78, 1.85), (1.22, 0.1, 1.92), (0.18, 0.7, 2.0)]):
            leaf_cluster(f"Falling_Petal_{index + 1:02d}", position, (0.055, 0.025, 0.08), mats["accent"])
    roots(radius, mats["bark"], mats["chrono"])
    chrono_ring(radius * 0.58, 0.14, mats["chrono"])


def add_bonsai_pot(stage: str, mats: dict[str, bpy.types.Material]) -> float:
    pot_scale = {"seedling": 0.56, "growing": 0.74, "mature": 0.9}[stage]
    cone("Bonsai_Pot", pot_scale, 0.42 * pot_scale / 0.9, 0.22, mats["pot"], top_radius=pot_scale * 0.78, vertices=8)
    cone("Bonsai_Soil", pot_scale * 0.74, 0.05, 0.44 * pot_scale / 0.9, mats["soil"], top_radius=pot_scale * 0.72, vertices=12)
    return 0.42 * pot_scale / 0.9


def build_bonsai(stage: str, mats: dict[str, bpy.types.Material]) -> None:
    base_z = add_bonsai_pot(stage, mats)
    if stage == "seedling":
        tapered_segment("Bonsai_Stem", (0, 0, base_z), (0.1, 0, 1.15), 0.08, 0.025, mats["bark_light"], 6)
        leaf_cluster("Bonsai_Leaf_01", (-0.16, 0, 0.96), (0.3, 0.2, 0.2), mats["primary"])
        leaf_cluster("Bonsai_Leaf_02", (0.22, 0, 1.18), (0.34, 0.24, 0.23), mats["secondary"])
    else:
        height = 1.62 if stage == "growing" else 2.05
        tapered_segment("Bonsai_Trunk_01", (0, 0, base_z), (0.22, 0.02, base_z + 0.6), 0.18, 0.12, mats["bark"], 7)
        tapered_segment("Bonsai_Trunk_02", (0.22, 0.02, base_z + 0.54), (-0.16, 0.03, height), 0.13, 0.045, mats["bark_light"], 7)
        endpoints = [(-0.74, 0.06, height - 0.22), (0.68, -0.03, height - 0.02)]
        if stage == "mature": endpoints.append((0.02, 0.55, height + 0.2))
        for index, endpoint in enumerate(endpoints):
            tapered_segment(f"Bonsai_Branch_{index + 1:02d}", (-0.02, 0.03, height - 0.55 + index * 0.08), endpoint, 0.075, 0.02, mats["bark_light"], 6)
            leaf_cluster(f"Bonsai_Pad_{index + 1:02d}", endpoint, (0.6 if stage == "mature" else 0.48, 0.42, 0.3), mats[["primary", "secondary", "accent"][index % 3]])
        leaf_cluster("Bonsai_Crown", (-0.15, 0.02, height + 0.18), (0.66 if stage == "mature" else 0.5, 0.48, 0.38), mats["secondary"])
    chrono_ring({"seedling": 0.36, "growing": 0.48, "mature": 0.58}[stage], base_z + 0.05, mats["chrono_core"])


def build_willow(stage: str, mats: dict[str, bpy.types.Material]) -> None:
    if stage == "seedling":
        tapered_segment("Willow_Stem", (0, 0, 0.02), (0.02, 0, 1.35), 0.095, 0.035, mats["bark_light"], 6)
        leaf_cluster("Willow_Leaf_01", (-0.3, 0, 1.08), (0.25, 0.12, 0.32), mats["primary"], (0.2, 0, -0.45))
        leaf_cluster("Willow_Leaf_02", (0.28, 0, 1.24), (0.25, 0.12, 0.34), mats["secondary"], (-0.2, 0, 0.45))
        crown_z, radius, strands = 1.42, 0.4, 3
    else:
        height = 2.15 if stage == "growing" else 3.0
        tapered_segment("Willow_Trunk", (0, 0, 0.02), (0.04, 0, height - 0.72), 0.22 if stage == "growing" else 0.33, 0.11, mats["bark"], 8)
        endpoints = [(-0.72, 0.1, height - 0.28), (0.72, -0.1, height - 0.18), (0.0, 0.68, height - 0.08)]
        if stage == "mature": endpoints += [(-0.56, -0.64, height), (0.58, 0.62, height + 0.04)]
        for index, endpoint in enumerate(endpoints):
            tapered_segment(f"Willow_Branch_{index + 1:02d}", (0.02, 0, height - 1.05 + index * 0.06), endpoint, 0.095, 0.025, mats["bark_light"], 6)
        crown_z, radius, strands = height, 0.86 if stage == "growing" else 1.16, 8 if stage == "growing" else 14
        leaf_cluster("Willow_Crown", (0, 0, crown_z), (radius, radius * 0.82, radius * 0.56), mats["primary"])
        leaf_cluster("Willow_Crown_Light", (0.12, -0.08, crown_z + 0.22), (radius * 0.76, radius * 0.68, radius * 0.42), mats["secondary"])
    for index in range(strands):
        angle = index * math.tau / strands
        strand_radius = radius * (0.72 + (index % 3) * 0.1)
        top = (math.cos(angle) * strand_radius, math.sin(angle) * strand_radius, crown_z + 0.04)
        middle = (math.cos(angle + 0.1) * strand_radius * 1.04, math.sin(angle + 0.1) * strand_radius * 1.04, crown_z - radius * 0.72)
        bottom = (math.cos(angle + 0.18) * strand_radius * 0.92, math.sin(angle + 0.18) * strand_radius * 0.92, crown_z - radius * 1.45)
        energy_path([top, middle, bottom], mats["accent"] if index % 2 else mats["secondary"], f"Willow_Frond_{index + 1:02d}")
    roots(radius * 0.82, mats["bark"], mats["chrono"])
    chrono_ring(radius * 0.52, 0.13, mats["chrono"])


def build_lavender(stage: str, mats: dict[str, bpy.types.Material]) -> None:
    counts = {"seedling": 3, "growing": 8, "mature": 15}
    count = counts[stage]
    height = {"seedling": 1.05, "growing": 1.55, "mature": 2.0}[stage]
    cone("Lavender_Soil", 0.36 + count * 0.025, 0.14, 0.07, mats["soil"], top_radius=0.3 + count * 0.024, vertices=12)
    for index in range(count):
        angle = index * 2.399963
        radius = 0.12 + 0.038 * index
        x, y = math.cos(angle) * radius, math.sin(angle) * radius
        stem_height = height * (0.76 + (index % 5) * 0.055)
        tapered_segment(f"Lavender_Stem_{index + 1:02d}", (x * 0.32, y * 0.32, 0.12), (x, y, stem_height), 0.025, 0.011, mats["bark_light"], 5)
        for bloom in range(3 if stage == "mature" else 2):
            leaf_cluster(
                f"Lavender_Bloom_{index + 1:02d}_{bloom + 1}",
                (x, y, stem_height - bloom * 0.11),
                (0.075, 0.075, 0.105),
                mats[["primary", "secondary", "accent"][(index + bloom) % 3]],
            )
    chrono_ring(0.42 + count * 0.018, 0.11, mats["chrono_core"])


def sunflower_head(
    location: tuple[float, float, float],
    radius: float,
    mats: dict[str, bpy.types.Material],
    *,
    open_flower: bool,
) -> None:
    x, y, z = location
    if not open_flower:
        leaf_cluster("Sunflower_Bud", location, (radius * 0.7, radius * 0.38, radius), mats["secondary"], (math.pi / 2, 0, 0))
        return
    petals = 14
    for index in range(petals):
        angle = index * math.tau / petals
        petal_position = (x + math.cos(angle) * radius * 0.78, y - 0.025, z + math.sin(angle) * radius * 0.78)
        leaf_cluster(
            f"Sunflower_Petal_{index + 1:02d}",
            petal_position,
            (radius * 0.42, radius * 0.10, radius * 0.18),
            mats["secondary"] if index % 2 else mats["accent"],
            (0, angle, 0),
        )
    leaf_cluster(
        "Sunflower_Centre",
        (x, y - 0.10, z),
        (radius * 0.5, radius * 0.14, radius * 0.5),
        mats["dark"],
    )


def build_sunflower(stage: str, mats: dict[str, bpy.types.Material]) -> None:
    height = {"seedling": 1.1, "growing": 1.9, "mature": 2.7}[stage]
    tapered_segment("Sunflower_Stem", (0, 0, 0.03), (0, 0, height), 0.075 if stage == "seedling" else 0.11, 0.045, mats["bark_light"], 7)
    leaf_positions = [(-0.34, 0, height * 0.38), (0.38, 0, height * 0.53)]
    if stage == "mature": leaf_positions += [(-0.42, 0.02, height * 0.67), (0.4, -0.02, height * 0.76)]
    for index, position in enumerate(leaf_positions):
        side = -1 if position[0] < 0 else 1
        tapered_segment(f"Leaf_Stem_{index + 1:02d}", (0, 0, position[2] - 0.08), position, 0.035, 0.012, mats["bark"], 5)
        leaf_cluster(f"Sunflower_Leaf_{index + 1:02d}", (position[0] + side * 0.12, 0, position[2]), (0.34, 0.11, 0.2), mats["bark"], (0, 0, side * 0.38))
    if stage == "seedling":
        leaf_cluster("Sunflower_Top_Leaf", (0, 0, height + 0.06), (0.25, 0.16, 0.22), mats["bark_light"])
    else:
        sunflower_head((0, 0, height), 0.36 if stage == "growing" else 0.62, mats, open_flower=stage == "mature")
    chrono_ring({"seedling": 0.34, "growing": 0.45, "mature": 0.58}[stage], 0.11, mats["chrono"])


BUILDERS = {
    "oak": build_oak,
    "pine": build_pine,
    "cherry-blossom": build_cherry_blossom,
    "bonsai": build_bonsai,
    "willow": build_willow,
    "lavender": build_lavender,
    "sunflower": build_sunflower,
}


def export_asset(species: str, stage: str) -> None:
    reset_scene()
    mats = make_materials(species)
    BUILDERS[species](stage, mats)

    root = bpy.data.objects.new(f"Chrono_{species.replace('-', '_').title()}_{stage.title()}", None)
    bpy.context.collection.objects.link(root)
    for obj in list(bpy.context.collection.objects):
        if obj is not root and obj.parent is None:
            obj.parent = root
    root["asset_author"] = "CHRONO team"
    root["asset_family"] = f"Chrono {species.replace('-', ' ').title()}"
    root["growth_stage"] = stage
    root["generated_by"] = "tools/blender/generate_chrono_plant_collection.py"

    destination = OUTPUT_ROOT / species
    destination.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(destination / f"{stage}.blend"), check_existing=False)
    bpy.ops.export_scene.gltf(
        filepath=str(destination / f"{stage}.glb"),
        export_format="GLB",
        export_apply=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )
    print(f"Exported {species}/{stage}")


if __name__ == "__main__":
    for plant_species in BUILDERS:
        for growth_stage in STAGES:
            export_asset(plant_species, growth_stage)
