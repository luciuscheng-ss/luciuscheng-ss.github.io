#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成自定义速率/自定义轨迹的 GPX 文件，配合 pymobiledevice3 使用：

    python gen_route.py waypoints.txt --speed 40 --out route.gpx
    pymobiledevice3 developer dvt simulate-location play route.gpx

原理：pymobiledevice3 的 `play` 命令严格按 GPX 里每个轨迹点的 <time>
时间戳来控制播放节奏（sleep 到下一个点的时间差再更新坐标），所以速度
控制不需要碰任何设备连接代码，只要生成时间戳正确的 GPX 文件即可。

waypoints.txt 格式：每行一个坐标 "纬度,经度"，可选第三列指定去程速度：

    39.9042,116.4074
    39.9163,116.3972,60
    39.9280,116.4100

第二行的 60 表示"从上一个点走到这一行这个点，用 60 km/h"，不写就用
--speed 指定的默认速度。地图网页/App 里右键一个点通常能直接复制出
"纬度, 经度"格式，粘贴进来去掉多余文字即可。
"""
import argparse
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

import gpxpy
import gpxpy.gpx


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """两点间大圆距离，单位米。"""
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def read_waypoints(path: Path):
    """返回 [(lat, lon, 该段速度km/h或None), ...]"""
    points = []
    # utf-8-sig 会自动剥离 Windows 记事本/PowerShell 常加的 UTF-8 BOM，
    # 没有 BOM 的文件也能正常读，比 utf-8 更安全
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.replace("，", ",").split(",")]
        lat, lon = float(parts[0]), float(parts[1])
        seg_speed = float(parts[2]) if len(parts) > 2 and parts[2] else None
        points.append((lat, lon, seg_speed))
    if len(points) < 2:
        raise ValueError("至少需要 2 个坐标点才能构成一条轨迹")
    return points


def build_route(waypoints, default_speed_kmh: float, update_interval_s: float):
    """
    在相邻两个路点之间按给定速度线性插值，每隔 update_interval_s 秒
    生成一个中间点，使movement在地图上显示为平滑移动而不是跳变。
    返回 [(lat, lon, 累计经过的秒数), ...]
    """
    dense = [(waypoints[0][0], waypoints[0][1], 0.0)]
    t = 0.0
    for (lat1, lon1, _), (lat2, lon2, seg_speed) in zip(waypoints, waypoints[1:]):
        speed_kmh = seg_speed if seg_speed else default_speed_kmh
        if speed_kmh <= 0:
            raise ValueError(f"速度必须大于 0（出现了 {speed_kmh} km/h）")
        speed_ms = speed_kmh * 1000 / 3600

        dist = haversine_m(lat1, lon1, lat2, lon2)
        duration = dist / speed_ms
        steps = max(1, math.ceil(duration / update_interval_s))

        for i in range(1, steps + 1):
            frac = i / steps
            lat = lat1 + (lat2 - lat1) * frac
            lon = lon1 + (lon2 - lon1) * frac
            t += duration / steps
            dense.append((lat, lon, t))
    return dense


def write_gpx(dense_points, out_path: Path):
    gpx = gpxpy.gpx.GPX()
    track = gpxpy.gpx.GPXTrack()
    gpx.tracks.append(track)
    segment = gpxpy.gpx.GPXTrackSegment()
    track.segments.append(segment)

    start = datetime(2024, 1, 1, tzinfo=timezone.utc)  # 绝对时间无所谓，只有相对间隔起作用
    for lat, lon, elapsed in dense_points:
        segment.points.append(
            gpxpy.gpx.GPXTrackPoint(
                latitude=lat,
                longitude=lon,
                time=start + timedelta(seconds=elapsed),
            )
        )
    out_path.write_text(gpx.to_xml(), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description="生成自定义速率轨迹的 GPX 文件")
    ap.add_argument("waypoints", type=Path, help="坐标文件，每行 纬度,经度[,该段速度km/h]")
    ap.add_argument("--speed", type=float, default=5.0, help="默认速度 km/h（默认 5，步行速度）")
    ap.add_argument("--interval", type=float, default=1.0, help="更新间隔秒数，默认 1 秒一个点")
    ap.add_argument("--out", type=Path, default=Path("route.gpx"), help="输出 GPX 文件路径")
    ap.add_argument("--loop", action="store_true", help="首尾相连成闭环")
    ap.add_argument("--repeat", type=int, default=1, help="整条路线重复播放几次（默认 1）")
    args = ap.parse_args()

    waypoints = read_waypoints(args.waypoints)
    if args.loop:
        waypoints = waypoints + [waypoints[0]]

    dense = build_route(waypoints, args.speed, args.interval)

    if args.repeat > 1:
        one_lap_time = dense[-1][2]
        full = list(dense)
        for lap in range(1, args.repeat):
            offset = lap * one_lap_time
            full.extend((lat, lon, t + offset) for lat, lon, t in dense)
        dense = full

    write_gpx(dense, args.out)

    total_time = dense[-1][2]
    total_dist = sum(
        haversine_m(dense[i][0], dense[i][1], dense[i + 1][0], dense[i + 1][1])
        for i in range(len(dense) - 1)
    )
    print(f"生成 {len(dense)} 个轨迹点 -> {args.out}")
    print(f"总距离 {total_dist / 1000:.2f} km，预计耗时 {total_time / 60:.1f} 分钟")
    print(f"\n播放：pymobiledevice3 developer dvt simulate-location play {args.out}")
    print("停止后如需恢复真实定位：pymobiledevice3 developer dvt simulate-location clear")


if __name__ == "__main__":
    main()
