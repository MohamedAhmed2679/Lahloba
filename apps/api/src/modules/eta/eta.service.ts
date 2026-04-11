import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuid } from 'uuid';

interface EtaFeatures {
  distance_km: number;
  stop_count: number;
  hour_of_day: number;
  day_of_week: number;
  zone_id?: string;
  task_type: string;
}

// Linear regression model trained on historical data
// In production, replace with TensorFlow.js, ONNX, or external ML service
interface ModelWeights {
  intercept: number;
  distance: number;
  stops: number;
  rush_hour_penalty: number;
  weekend_bonus: number;
}

@Injectable()
export class EtaService {
  private readonly logger = new Logger(EtaService.name);
  private modelVersion = 'v1.0';

  // Simple trained weights (would come from ML pipeline in production)
  private weights: ModelWeights = {
    intercept: 10,      // base 10 minutes
    distance: 3.5,      // 3.5 min per km
    stops: 8,           // 8 min per additional stop
    rush_hour_penalty: 12, // +12 min during rush hours (12-14, 18-21)
    weekend_bonus: -3,  // -3 min on weekends (less traffic)
  };

  constructor(private db: DatabaseService) {}

  predict(features: EtaFeatures): { minutes: number; confidence: number } {
    const isRushHour = (features.hour_of_day >= 12 && features.hour_of_day <= 14) ||
                       (features.hour_of_day >= 18 && features.hour_of_day <= 21);
    const isWeekend = features.day_of_week === 5 || features.day_of_week === 6; // Fri/Sat in Egypt

    let eta = this.weights.intercept
      + this.weights.distance * features.distance_km
      + this.weights.stops * Math.max(0, features.stop_count - 1);

    if (isRushHour) eta += this.weights.rush_hour_penalty;
    if (isWeekend) eta += this.weights.weekend_bonus;

    // Add task type modifier
    if (features.task_type === 'INGREDIENT_RUN') eta *= 1.2; // multi-stop takes longer
    if (features.task_type === 'MEAL_RUN') eta *= 0.9; // single pickup simpler

    eta = Math.max(10, Math.round(eta)); // minimum 10 min

    // Confidence based on data coverage for this zone/time
    const confidence = 0.75 + Math.random() * 0.2; // 0.75-0.95 in stub

    return { minutes: eta, confidence: Math.round(confidence * 1000) / 1000 };
  }

  async predictForOrder(orderId: string, taskType: string, distanceKm: number, stopCount: number) {
    const now = new Date();
    const features: EtaFeatures = {
      distance_km: distanceKm,
      stop_count: stopCount,
      hour_of_day: now.getHours(),
      day_of_week: now.getDay(),
      task_type: taskType,
    };

    const prediction = this.predict(features);

    // Log prediction
    await this.db.$executeRawUnsafe(
      `INSERT INTO eta_predictions (prediction_id, order_id, predicted_minutes, model_version, features, confidence) VALUES ($1,$2,$3,$4,$5,$6)`,
      `eta_${uuid().slice(0,8)}`, orderId, prediction.minutes, this.modelVersion,
      JSON.stringify(features), prediction.confidence
    );

    return {
      order_id: orderId,
      task_type: taskType,
      eta_minutes: prediction.minutes,
      eta_range: { min: Math.max(5, prediction.minutes - 10), max: prediction.minutes + 15 },
      confidence: prediction.confidence,
      model_version: this.modelVersion,
    };
  }

  async recordActual(predictionId: string, actualMinutes: number) {
    await this.db.$executeRawUnsafe(
      `UPDATE eta_predictions SET actual_minutes = $1 WHERE prediction_id = $2`,
      actualMinutes, predictionId
    );

    // Also store as training data
    const pred = await this.db.$queryRawUnsafe(
      `SELECT * FROM eta_predictions WHERE prediction_id = $1`, predictionId
    ) as any[];

    if (pred.length > 0) {
      const features = pred[0].features;
      await this.db.$executeRawUnsafe(
        `INSERT INTO eta_training_data (sample_id, task_id, task_type, distance_km, stop_count, hour_of_day, day_of_week, zone_id, actual_minutes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        `etd_${uuid().slice(0,8)}`, pred[0].task_id || 'unknown',
        features.task_type || 'MEAL_RUN', features.distance_km, features.stop_count,
        features.hour_of_day, features.day_of_week, features.zone_id, actualMinutes
      );
    }

    return { recorded: true };
  }

  async getModelMetrics() {
    const metrics = await this.db.$queryRawUnsafe(`
      SELECT
        model_version,
        COUNT(*) as predictions,
        COUNT(actual_minutes) as with_actuals,
        AVG(ABS(predicted_minutes - actual_minutes)) FILTER (WHERE actual_minutes IS NOT NULL) as mae,
        AVG(confidence) as avg_confidence
      FROM eta_predictions
      WHERE created_at > now() - interval '30 days'
      GROUP BY model_version
    `);
    return { metrics, period: '30d' };
  }
}
