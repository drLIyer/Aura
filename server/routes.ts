import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { calculateCyclePhase } from "./cycleCalculator";
import { generateInsights, calculateCycleCorrelation } from "./insightsGenerator";
import { generateMLDataset, convertToCSV } from "./mlExport";
import { calculateMigraineProbability } from "./migraineProbabilityCalculator";
import { writeFile } from "fs/promises";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/health/today", async (req, res) => {
    try {
      const dateParam = req.query.date as string | undefined;
      const dateToQuery = dateParam || new Date().toISOString().split('T')[0];

      const dbMetrics = await storage.getHealthMetrics(dateToQuery);
      if (dbMetrics) {
        return res.json({
          readiness: dbMetrics.readiness,
          sleep: dbMetrics.sleep,
          stress: dbMetrics.stress
        });
      }

      return res.json({ readiness: null, sleep: null, stress: null });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch health metrics" });
    }
  });

  app.post("/api/health", async (req, res) => {
    try {
      const { date, readiness, sleep, stress } = req.body;
      if (!date || readiness === undefined || sleep === undefined || stress === undefined) {
        return res.status(400).json({ error: "Missing required fields: date, readiness, sleep, stress" });
      }
      const entry = await storage.upsertHealthMetrics(date, readiness, sleep, stress);
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to save health metrics" });
    }
  });

  app.get("/api/health/trends", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const trends = await storage.getHealthMetricsTrend(days);
      res.json(trends);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trend data" });
    }
  });

  app.get("/api/cycle/current", async (req, res) => {
    try {
      const cycles = await storage.getCycleLog();
      const phaseInfo = calculateCyclePhase(cycles);
      res.json(phaseInfo || { currentDay: null, cycleLength: null, phase: null, daysUntilPeriod: null, isHighRiskPMS: false });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate cycle phase" });
    }
  });

  app.get("/api/insights", async (req, res) => {
    try {
      const migraines = await storage.getMigraineLog();
      const waterLog = await storage.getWaterLog();
      const cycleLog = await storage.getCycleLog();
      const healthMetrics = await storage.getHealthMetricsTrend(14);

      const insights = generateInsights(migraines, waterLog, cycleLog, healthMetrics);
      res.json(insights);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate insights" });
    }
  });

  app.get("/api/analytics/cycle-correlation", async (req, res) => {
    try {
      const migraines = await storage.getMigraineLog();
      const cycleLog = await storage.getCycleLog();
      const correlation = calculateCycleCorrelation(migraines, cycleLog);
      res.json(correlation);
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate correlation" });
    }
  });

  app.get("/api/migraine-probability", async (req, res) => {
    try {
      const dateParam = req.query.date as string | undefined;
      const dateStr = dateParam || new Date().toISOString().split('T')[0];

      const cycles = await storage.getCycleLog();
      const phaseInfo = calculateCyclePhase(cycles);

      const dbMetrics = await storage.getHealthMetrics(dateStr);
      const scores = {
        readiness: dbMetrics?.readiness,
        sleep: dbMetrics?.sleep,
        stress: dbMetrics?.stress
      };

      const probability = calculateMigraineProbability(
        scores,
        phaseInfo?.currentDay,
        phaseInfo?.phase
      );

      res.json({
        ...probability,
        date: dateStr,
        scores
      });
    } catch (error) {
      console.error("Error calculating migraine probability:", error);
      res.status(500).json({ error: "Failed to calculate migraine probability" });
    }
  });

  app.get("/api/water", async (req, res) => {
    try {
      const dateParam = req.query.date as string | undefined;
      const entries = await storage.getWaterLog(dateParam);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch water log" });
    }
  });

  app.post("/api/water", async (req, res) => {
    try {
      const { amount, date } = req.body;
      const entry = await storage.addWaterLog(amount, date);
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to log water" });
    }
  });

  app.get("/api/supplements", async (req, res) => {
    try {
      const dateParam = req.query.date as string | undefined;
      const entries = await storage.getSupplementLog(dateParam);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch supplement log" });
    }
  });

  app.post("/api/supplements", async (req, res) => {
    try {
      const { name, dosage, date } = req.body;
      const entry = await storage.addSupplementLog(name, dosage, date);
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to log supplement" });
    }
  });

  app.get("/api/meals", async (req, res) => {
    try {
      const entries = await storage.getMealLog();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch meal log" });
    }
  });

  app.post("/api/meals", async (req, res) => {
    try {
      const { type } = req.body;
      const entry = await storage.addMealLog(type);
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to log meal" });
    }
  });

  app.get("/api/migraines", async (req, res) => {
    try {
      const entries = await storage.getMigraineLog();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch migraine log" });
    }
  });

  app.post("/api/migraines", async (req, res) => {
    try {
      const { severity, duration, symptoms, triggers, notes, medications } = req.body;
      const entry = await storage.addMigraineLog(severity, duration, symptoms, triggers, notes, medications);
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to log migraine" });
    }
  });

  app.get("/api/cycle", async (req, res) => {
    try {
      const entries = await storage.getCycleLog();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cycle log" });
    }
  });

  app.post("/api/cycle", async (req, res) => {
    try {
      const { startDate, endDate } = req.body;
      const entry = await storage.addCycleLog(startDate, endDate);
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to log cycle" });
    }
  });

  app.get("/api/export/ml-data", async (req, res) => {
    try {
      const dataset = await generateMLDataset();
      const csv = convertToCSV(dataset);

      await writeFile('ml/data/input_data.csv', csv);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=migraine_data.csv');
      res.send(csv);
    } catch (error) {
      console.error("ML export error:", error);
      res.status(500).json({ error: "Failed to export ML data" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
