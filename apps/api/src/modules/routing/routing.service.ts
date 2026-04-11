import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuid } from 'uuid';

interface Stop { lat: number; lng: number; id: string; type: string; }

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(private db: DatabaseService) {}

  // Haversine distance between two lat/lng points
  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // Nearest neighbor heuristic for TSP
  private nearestNeighborRoute(stops: Stop[], startLat: number, startLng: number): Stop[] {
    const unvisited = [...stops];
    const route: Stop[] = [];
    let currentLat = startLat;
    let currentLng = startLng;

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < unvisited.length; i++) {
        const d = this.haversine(currentLat, currentLng, unvisited[i].lat, unvisited[i].lng);
        if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
      }
      const next = unvisited.splice(nearestIdx, 1)[0];
      route.push(next);
      currentLat = next.lat;
      currentLng = next.lng;
    }
    return route;
  }

  // 2-opt improvement
  private twoOptImprove(route: Stop[]): Stop[] {
    let improved = true;
    let best = [...route];
    while (improved) {
      improved = false;
      for (let i = 0; i < best.length - 1; i++) {
        for (let j = i + 2; j < best.length; j++) {
          const newRoute = [...best.slice(0, i+1), ...best.slice(i+1, j+1).reverse(), ...best.slice(j+1)];
          if (this.totalDistance(newRoute) < this.totalDistance(best)) {
            best = newRoute;
            improved = true;
          }
        }
      }
    }
    return best;
  }

  private totalDistance(stops: Stop[]): number {
    let total = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      total += this.haversine(stops[i].lat, stops[i].lng, stops[i+1].lat, stops[i+1].lng);
    }
    return total;
  }

  async optimizeRoute(taskId: string) {
    const stops = await this.db.$queryRawUnsafe(
      `SELECT stop_id as id, stop_type as type, lat, lng, sequence FROM delivery_stops WHERE task_id = $1 ORDER BY sequence`, taskId
    ) as Stop[];

    if (stops.length < 3) return { task_id: taskId, optimized: false, reason: 'Too few stops' };

    const startTime = Date.now();
    const original = this.totalDistance(stops);

    // Optimize using nearest neighbor + 2-opt
    const nn = this.nearestNeighborRoute(stops.slice(0, -1), stops[0].lat, stops[0].lng);
    nn.push(stops[stops.length - 1]); // Keep final destination last
    const optimized = this.twoOptImprove(nn);
    const newDist = this.totalDistance(optimized);

    const saved = original - newDist;
    const computeMs = Date.now() - startTime;

    // Update stop sequences
    for (let i = 0; i < optimized.length; i++) {
      await this.db.$executeRawUnsafe(
        `UPDATE delivery_stops SET sequence = $1 WHERE stop_id = $2`, i + 1, optimized[i].id
      );
    }

    // Log optimization
    await this.db.$executeRawUnsafe(
      `INSERT INTO route_optimization_log (log_id, zone_id, algorithm, tasks_input, tasks_batched, distance_saved_km, time_saved_min, computation_ms) VALUES ($1,'zone_giza','nn_2opt',$2,$3,$4,$5,$6)`,
      `ropt_${uuid().slice(0,8)}`, stops.length, stops.length, saved, Math.round(saved * 3), computeMs
    );

    return {
      task_id: taskId,
      optimized: true,
      original_distance_km: Math.round(original * 100) / 100,
      optimized_distance_km: Math.round(newDist * 100) / 100,
      distance_saved_km: Math.round(saved * 100) / 100,
      time_saved_min: Math.round(saved * 3), // ~3 min/km estimate
      computation_ms: computeMs,
      new_sequence: optimized.map((s, i) => ({ stop_id: s.id, sequence: i + 1 })),
    };
  }

  async batchOptimize(zoneId: string) {
    const available = await this.db.$queryRawUnsafe(
      `SELECT dt.task_id, dt.stop_count FROM delivery_tasks dt WHERE dt.status = 'AVAILABLE' AND dt.stop_count >= 3`
    ) as any[];

    const results = [];
    for (const task of available) {
      try {
        const result = await this.optimizeRoute(task.task_id);
        results.push(result);
      } catch (e) {
        results.push({ task_id: task.task_id, error: (e as Error).message });
      }
    }

    return { zone_id: zoneId, tasks_optimized: results.filter((r: any) => r.optimized).length, results };
  }
}
