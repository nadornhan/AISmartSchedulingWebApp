"""Generate CHRONO's original legendary final-tier tree.

This asset deliberately lives in the design-draft collection until approved.
It is taller, wider, and more detailed than every regular plant family.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))

from generate_chrono_maple import (
    energy_path,
    leaf_cluster,
    material,
    reset_scene,
    tapered_segment,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "assets" / "3d" / "chrono-plants" / "chrono"
STAGES = ("seedling", "growing", "mature")

COLORS = {
    "void_bark": (0.018, 0.025, 0.085, 1.0),
    "violet_bark": (0.15, 0.055, 0.27, 1.0),
    "deep_canopy": (0.015, 0.16, 0.22, 1.0),
    "cyan_canopy": (0.015, 0.55, 0.60, 1.0),
    "violet_canopy": (0.31, 0.10, 0.62, 1.0),
    "magenta_canopy": (0.64, 0.055, 0.50, 1.0),
    "gold_canopy": (0.92, 0.45, 0.035, 1.0),
    "chrono_energy": (0.0, 0.96, 0.75, 1.0),
    "time_core": (0.36, 0.9, 1.0, 1.0),
    "time_gold": (1.0, 0.68, 0.12, 1.0),
    "time_violet": (0.67, 0.25, 1.0, 1.0),
}


def make_materials() -> dict[str, bpy.types.Material]:
    emissive = {"chrono_energy": 3.8, "time_core": 5.0, "time_gold": 3.8, "time_violet": 3.2}
    return {
        name: material(f"Chrono_Legendary_{name}", color, emission=emissive.get(name, 0.0))
        for name, color in COLORS.items()
    }


def assign(obj: bpy.types.Object, mat: bpy.types.Material) -> bpy.types.Object:
    obj.data.materials.append(mat)
    for polygon in getattr(obj.data, "polygons", []):
        polygon.use_smooth = False
    return obj


def torus_ring(
    name: str,
    radius: float,
    thickness: float,
    location: tuple[float, float, float],
    rotation: tuple[float, float, float],
    mat: bpy.types.Material,
    segments: int = 40,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=radius,
        minor_radius=thickness,
        major_segments=segments,
        minor_segments=6,
        location=location,
        rotation=rotation,
    )
    obj = assign(bpy.context.object, mat)
    obj.name = name
    return obj


def time_markers(
    radius: float,
    centre: tuple[float, float, float],
    mat: bpy.types.Material,
    count: int = 12,
) -> None:
    cx, cy, cz = centre
    for index in range(count):
        angle = index * math.tau / count
        x = cx + math.sin(angle) * radius
        z = cz + math.cos(angle) * radius
        leaf_cluster(
            f"Hour_Marker_{index + 1:02d}",
            (x, cy - 0.025, z),
            (0.055 if index % 3 else 0.08, 0.04, 0.11 if index % 3 else 0.16),
            mat,
            (0, angle, 0),
        )


def legendary_roots(
    radius: float,
    bark: bpy.types.Material,
    energy: bpy.types.Material,
    count: int,
) -> None:
    for index in range(count):
        angle = index * math.tau / count
        start = (math.cos(angle) * 0.08, math.sin(angle) * 0.08, 0.14)
        bend = (math.cos(angle + 0.08) * radius * 0.48, math.sin(angle + 0.08) * radius * 0.48, 0.065)
        end = (math.cos(angle) * radius, math.sin(angle) * radius, 0.02)
        tapered_segment(f"Ancient_Root_A_{index + 1:02d}", start, bend, radius * 0.085, radius * 0.045, bark, 7)
        tapered_segment(f"Ancient_Root_B_{index + 1:02d}", bend, end, radius * 0.05, 0.012, bark, 6)
        if index % 2 == 0:
            energy_path(
                [
                    (start[0] * 0.9, start[1] * 0.9, start[2] + 0.018),
                    (bend[0], bend[1], bend[2] + 0.025),
                    (end[0] * 0.94, end[1] * 0.94, end[2] + 0.03),
                ],
                energy,
                f"Root_Constellation_{index + 1:02d}",
            )


def time_core(
    location: tuple[float, float, float],
    radius: float,
    mats: dict[str, bpy.types.Material],
    *,
    clock_hands: bool,
) -> None:
    leaf_cluster("Time_Core_Outer", location, (radius, radius * 0.8, radius), mats["time_core"])
    leaf_cluster(
        "Time_Core_Inner",
        (location[0], location[1] - radius * 0.12, location[2]),
        (radius * 0.48, radius * 0.48, radius * 0.48),
        mats["time_gold"],
        (0.2, 0.4, 0.1),
    )
    if clock_hands:
        tapered_segment(
            "Clock_Hand_Hour",
            (location[0], location[1] - radius * 0.82, location[2]),
            (location[0] - radius * 0.38, location[1] - radius * 0.84, location[2] + radius * 0.32),
            radius * 0.055,
            radius * 0.025,
            mats["time_gold"],
            6,
        )
        tapered_segment(
            "Clock_Hand_Minute",
            (location[0], location[1] - radius * 0.85, location[2]),
            (location[0] + radius * 0.12, location[1] - radius * 0.86, location[2] + radius * 0.56),
            radius * 0.045,
            radius * 0.018,
            mats["chrono_energy"],
            6,
        )


def floating_crystals(
    points: list[tuple[float, float, float]],
    scale: float,
    mats: list[bpy.types.Material],
) -> None:
    for index, point in enumerate(points):
        leaf_cluster(
            f"Time_Crystal_{index + 1:02d}",
            point,
            (scale * (0.75 + index % 3 * 0.12), scale * 0.42, scale * (1.2 + index % 2 * 0.24)),
            mats[index % len(mats)],
            (0.25 * index, 0.35 * index, 0.18 * index),
        )


def build_seedling(mats: dict[str, bpy.types.Material]) -> None:
    tapered_segment("Chrono_Sprout_Trunk", (0, 0, 0.03), (0.04, 0, 1.52), 0.13, 0.04, mats["violet_bark"], 7)
    tapered_segment("Chrono_Sprout_Left", (0.02, 0, 0.9), (-0.42, 0.02, 1.28), 0.05, 0.016, mats["violet_bark"], 6)
    tapered_segment("Chrono_Sprout_Right", (0.03, 0, 1.05), (0.42, -0.03, 1.4), 0.045, 0.014, mats["violet_bark"], 6)
    leaf_cluster("Crystal_Leaf_Left", (-0.52, 0.02, 1.35), (0.36, 0.16, 0.24), mats["cyan_canopy"], (0.1, 0.35, -0.48))
    leaf_cluster("Crystal_Leaf_Right", (0.52, -0.03, 1.47), (0.38, 0.17, 0.25), mats["violet_canopy"], (-0.1, -0.4, 0.48))
    leaf_cluster("Crystal_Crown", (0.05, 0, 1.7), (0.34, 0.28, 0.38), mats["magenta_canopy"], (0.2, 0.3, 0.1))
    legendary_roots(0.62, mats["void_bark"], mats["chrono_energy"], 6)
    torus_ring("Seedling_Time_Ring", 0.42, 0.018, (0, 0, 0.12), (0, 0, 0), mats["chrono_energy"], 28)
    time_core((0.02, -0.04, 0.77), 0.13, mats, clock_hands=False)


def build_growing(mats: dict[str, bpy.types.Material]) -> None:
    tapered_segment("Chrono_Trunk_Lower", (0, 0, 0.03), (0.11, 0.02, 1.65), 0.26, 0.15, mats["void_bark"], 8)
    tapered_segment("Chrono_Trunk_Upper", (0.11, 0.02, 1.52), (-0.08, 0.05, 2.7), 0.17, 0.065, mats["violet_bark"], 8)
    branches = [
        ((0.06, 0.01, 1.4), (-1.28, 0.12, 2.2)),
        ((0.1, 0.01, 1.58), (1.32, -0.12, 2.32)),
        ((0.0, 0.04, 1.78), (-0.72, -0.92, 2.5)),
        ((0.0, 0.04, 1.92), (0.78, 0.88, 2.6)),
    ]
    for index, (start, end) in enumerate(branches):
        tapered_segment(f"Growing_Time_Branch_{index + 1:02d}", start, end, 0.11, 0.025, mats["violet_bark"], 7)
    clusters = [
        ((-1.34, 0.12, 2.34), (0.88, 0.7, 0.64), mats["deep_canopy"]),
        ((1.38, -0.12, 2.45), (0.9, 0.72, 0.66), mats["cyan_canopy"]),
        ((-0.76, -0.9, 2.63), (0.76, 0.65, 0.62), mats["violet_canopy"]),
        ((0.78, 0.86, 2.72), (0.78, 0.66, 0.62), mats["magenta_canopy"]),
        ((-0.05, 0.02, 2.92), (1.05, 0.85, 0.74), mats["deep_canopy"]),
    ]
    for index, (position, scale, mat) in enumerate(clusters):
        leaf_cluster(f"Growing_Chrono_Canopy_{index + 1:02d}", position, scale, mat, (0.12 * index, 0.2, 0.28 * index))
    legendary_roots(1.0, mats["void_bark"], mats["chrono_energy"], 8)
    torus_ring("Growing_Ground_Orbit", 0.7, 0.024, (0, 0, 0.15), (0, 0, 0), mats["chrono_energy"], 36)
    torus_ring("Growing_Crown_Orbit", 0.82, 0.018, (0, 0.12, 2.18), (math.pi / 2, 0, 0), mats["time_violet"], 36)
    time_core((0.04, -0.1, 1.58), 0.23, mats, clock_hands=True)
    energy_path([(0.12, 0.24, 0.22), (-0.12, 0.21, 0.72), (0.14, 0.18, 1.18), (0.02, 0.14, 1.52)], mats["chrono_energy"], "Growing_Trunk_Constellation")
    floating_crystals([(-1.62, 0.02, 1.72), (1.68, 0.04, 1.9), (0.18, 1.2, 2.0)], 0.12, [mats["time_core"], mats["time_violet"], mats["time_gold"]])


def build_mature(mats: dict[str, bpy.types.Material]) -> None:
    # A split, slightly twisted trunk makes the final-tier silhouette unique.
    tapered_segment("World_Trunk_Base", (0, 0, 0.03), (0.13, 0.02, 2.25), 0.48, 0.29, mats["void_bark"], 9)
    tapered_segment("World_Trunk_Left", (0.1, 0.02, 2.02), (-0.28, 0.08, 3.75), 0.29, 0.10, mats["violet_bark"], 8)
    tapered_segment("World_Trunk_Right", (0.14, 0.02, 2.0), (0.38, -0.05, 3.6), 0.25, 0.085, mats["void_bark"], 8)

    endpoints = [
        (-2.35, 0.12, 3.35), (2.42, -0.1, 3.5),
        (-1.72, -1.25, 3.72), (1.78, 1.2, 3.88),
        (-0.82, 1.72, 4.1), (0.88, -1.65, 4.0),
        (-0.2, 0.15, 4.62),
    ]
    starts = [
        (0.08, 0.01, 1.9), (0.14, 0.0, 2.05),
        (0.04, 0.04, 2.28), (0.12, 0.03, 2.38),
        (-0.08, 0.07, 2.68), (0.2, -0.02, 2.72),
        (0.02, 0.05, 3.28),
    ]
    for index, (start, end) in enumerate(zip(starts, endpoints)):
        tapered_segment(f"World_Branch_{index + 1:02d}", start, end, 0.18 if index < 4 else 0.14, 0.035, mats["violet_bark"] if index % 2 else mats["void_bark"], 8)

    clusters = [
        ((-2.4, 0.12, 3.55), (1.35, 0.95, 0.9), mats["deep_canopy"]),
        ((2.48, -0.1, 3.68), (1.38, 0.98, 0.92), mats["cyan_canopy"]),
        ((-1.72, -1.22, 3.92), (1.22, 0.96, 0.9), mats["violet_canopy"]),
        ((1.8, 1.18, 4.05), (1.24, 0.98, 0.92), mats["magenta_canopy"]),
        ((-0.85, 1.68, 4.26), (1.15, 0.92, 0.88), mats["gold_canopy"]),
        ((0.9, -1.62, 4.18), (1.16, 0.94, 0.88), mats["deep_canopy"]),
        ((-0.15, 0.12, 4.76), (1.55, 1.18, 1.08), mats["violet_canopy"]),
        ((-0.75, -0.2, 4.42), (1.3, 1.0, 0.94), mats["cyan_canopy"]),
        ((0.82, 0.28, 4.5), (1.28, 1.0, 0.94), mats["magenta_canopy"]),
    ]
    for index, (position, scale, mat) in enumerate(clusters):
        leaf_cluster(f"World_Crown_{index + 1:02d}", position, scale, mat, (0.13 * index, 0.18 * index, 0.31 * index))

    legendary_roots(1.65, mats["void_bark"], mats["chrono_energy"], 12)
    torus_ring("World_Ground_Orbit_Outer", 1.18, 0.035, (0, 0, 0.18), (0, 0, 0), mats["chrono_energy"], 48)
    torus_ring("World_Ground_Orbit_Inner", 0.82, 0.022, (0, 0, 0.22), (0, 0, 0), mats["time_gold"], 40)

    halo_centre = (0.0, 0.5, 3.72)
    torus_ring("Great_Time_Halo", 1.48, 0.035, halo_centre, (math.pi / 2, 0, 0), mats["chrono_energy"], 64)
    torus_ring("Great_Time_Halo_Violet", 1.12, 0.022, (0.0, 0.48, 3.72), (math.pi / 2, 0.12, 0.18), mats["time_violet"], 56)
    time_markers(1.48, halo_centre, mats["time_gold"], 12)

    time_core((0.06, -0.2, 2.42), 0.38, mats, clock_hands=True)
    energy_path(
        [(0.16, 0.4, 0.24), (-0.16, 0.37, 0.82), (0.18, 0.32, 1.36), (-0.12, 0.27, 1.92), (0.13, 0.2, 2.35)],
        mats["chrono_energy"],
        "World_Trunk_Constellation",
    )
    energy_path(
        [(0.04, 0.18, 2.5), (-0.68, 0.15, 2.86), (-1.42, 0.12, 3.25), (-2.0, 0.1, 3.45)],
        mats["time_violet"],
        "Left_Time_Vein",
    )
    energy_path(
        [(0.1, 0.12, 2.5), (0.78, 0.08, 2.9), (1.52, 0.02, 3.28), (2.08, -0.04, 3.55)],
        mats["time_gold"],
        "Right_Time_Vein",
    )
    floating_crystals(
        [
            (-3.0, 0.05, 2.78), (3.05, 0.0, 2.95),
            (-2.42, 0.7, 4.7), (2.5, 0.65, 4.82),
            (-1.15, -1.9, 3.15), (1.28, -1.92, 3.36),
            (-0.15, 1.95, 3.42),
        ],
        0.2,
        [mats["time_core"], mats["time_violet"], mats["time_gold"]],
    )


BUILDERS = {"seedling": build_seedling, "growing": build_growing, "mature": build_mature}


def export_stage(stage: str) -> None:
    reset_scene()
    mats = make_materials()
    BUILDERS[stage](mats)

    root = bpy.data.objects.new(f"Chrono_Legendary_Tree_{stage.title()}", None)
    bpy.context.collection.objects.link(root)
    for obj in list(bpy.context.collection.objects):
        if obj is not root and obj.parent is None:
            obj.parent = root
    root["asset_author"] = "CHRONO team"
    root["asset_family"] = "Chrono Legendary Tree"
    root["rarity"] = "legendary"
    root["growth_stage"] = stage
    root["generated_by"] = "tools/blender/generate_chrono_legendary_tree.py"

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_DIR / f"{stage}.blend"), check_existing=False)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_DIR / f"{stage}.glb"),
        export_format="GLB",
        export_apply=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )
    print(f"Exported CHRONO legendary tree: {stage}")


if __name__ == "__main__":
    for growth_stage in STAGES:
        export_stage(growth_stage)

