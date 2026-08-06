import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { stmts } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ═══════════════════════════════════════════════
// API Routes
// ═══════════════════════════════════════════════

// ── Health Check ──
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Records CRUD ──

// Get all records for a user
app.get("/api/records", (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }
    const rows = stmts.getRecords.all(userId);
    // Convert to frontend format
    const records = {};
    rows.forEach((r) => {
      records[r.date] = {
        date: r.date,
        orders: r.orders,
        income: r.income,
        workHours: r.work_hours,
        weather: r.weather,
        note: r.note || "",
      };
    });
    res.json({ records, count: rows.length });
  } catch (err) {
    console.error("Error fetching records:", err);
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

// Get single record
app.get("/api/records/:date", (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }
    const row = stmts.getRecord.get(userId, req.params.date);
    if (!row) {
      return res.status(404).json({ error: "Record not found" });
    }
    res.json({
      date: row.date,
      orders: row.orders,
      income: row.income,
      workHours: row.work_hours,
      weather: row.weather,
      note: row.note || "",
    });
  } catch (err) {
    console.error("Error fetching record:", err);
    res.status(500).json({ error: "Failed to fetch record" });
  }
});

// Upsert (create or update) a record
app.put("/api/records", (req, res) => {
  try {
    const { user_id, date, orders, income, workHours, weather, note } = req.body;
    if (!user_id || !date) {
      return res.status(400).json({ error: "user_id and date are required" });
    }
    stmts.upsertRecord.run({
      user_id,
      date,
      orders: orders ?? 0,
      income: income ?? 0,
      work_hours: workHours ?? 0,
      weather: weather || "sunny",
      note: note || "",
    });
    res.json({ success: true, date });
  } catch (err) {
    console.error("Error saving record:", err);
    res.status(500).json({ error: "Failed to save record" });
  }
});

// Batch upsert records
app.put("/api/records/batch", (req, res) => {
  try {
    const { user_id, records } = req.body;
    if (!user_id || !Array.isArray(records)) {
      return res.status(400).json({ error: "user_id and records array are required" });
    }

    const upsertMany = stmts.upsertRecord;
    const result = { success: 0, failed: 0 };

    for (const r of records) {
      try {
        upsertMany.run({
          user_id,
          date: r.date,
          orders: r.orders ?? 0,
          income: r.income ?? 0,
          work_hours: r.workHours ?? 0,
          weather: r.weather || "sunny",
          note: r.note || "",
        });
        result.success++;
      } catch {
        result.failed++;
      }
    }
    res.json(result);
  } catch (err) {
    console.error("Error batch saving records:", err);
    res.status(500).json({ error: "Failed to batch save records" });
  }
});

// Delete a record
app.delete("/api/records/:date", (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }
    const result = stmts.deleteRecord.run(userId, req.params.date);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Record not found" });
    }
    res.json({ success: true, date: req.params.date });
  } catch (err) {
    console.error("Error deleting record:", err);
    res.status(500).json({ error: "Failed to delete record" });
  }
});

// ── Settings ──

// Get user settings
app.get("/api/settings", (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }
    const row = stmts.getSettings.get(userId);
    if (!row) {
      // Return defaults
      return res.json({
        riderName: "Power",
        monthlyGoal: 1000,
        dailyGoal: 40,
        basePrice: 4.2,
        bonusPrice: 4.5,
        bonusThreshold: 1500,
        workDaysPerWeek: 6,
        currentShift: "early_mid",
      });
    }

    let weeklyShifts = undefined;
    if (row.weekly_shifts) {
      try {
        const parsed = JSON.parse(row.weekly_shifts);
        if (parsed && typeof parsed === "object") weeklyShifts = parsed;
      } catch { /* ignore */ }
    }

    res.json({
      riderName: row.rider_name,
      monthlyGoal: row.monthly_goal,
      dailyGoal: row.daily_goal,
      basePrice: row.base_price,
      bonusPrice: row.bonus_price,
      bonusThreshold: row.bonus_threshold,
      workDaysPerWeek: row.work_days_per_week,
      currentShift: row.current_shift,
      shiftStartDate: row.shift_start_date || undefined,
      weeklyShifts,
      weeklyShiftsUpdatedAt: row.weekly_shifts_updated_at || undefined,
    });
  } catch (err) {
    console.error("Error fetching settings:", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// Update settings
app.put("/api/settings", (req, res) => {
  try {
    const {
      user_id,
      riderName,
      monthlyGoal,
      dailyGoal,
      basePrice,
      bonusPrice,
      bonusThreshold,
      workDaysPerWeek,
      currentShift,
      shiftStartDate,
      weeklyShifts,
      weeklyShiftsUpdatedAt,
    } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }
    stmts.upsertSettings.run({
      user_id,
      rider_name: riderName || "Power",
      monthly_goal: monthlyGoal ?? 1000,
      daily_goal: dailyGoal ?? 40,
      base_price: basePrice ?? 4.2,
      bonus_price: bonusPrice ?? 4.5,
      bonus_threshold: bonusThreshold ?? 1500,
      work_days_per_week: workDaysPerWeek ?? 6,
      current_shift: currentShift || "early_mid",
      shift_start_date: shiftStartDate || null,
      weekly_shifts: weeklyShifts ? JSON.stringify(weeklyShifts) : null,
      weekly_shifts_updated_at: weeklyShiftsUpdatedAt ?? null,
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Error saving settings:", err);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// ── Stats ──
app.get("/api/stats", (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }
    const stats = stmts.getStats.get(userId);
    res.json({
      totalDays: stats?.total_days || 0,
      totalOrders: stats?.total_orders || 0,
      totalIncome: stats?.total_income || 0,
      avgOrders: Math.round((stats?.avg_orders || 0) * 10) / 10,
      maxOrders: stats?.max_orders || 0,
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ── Serve static frontend in production ──
const distPath = path.join(__dirname, "..", "dist");
const APP_BASE = "/rider-app";

// Serve static assets under the app base path
app.use(APP_BASE, express.static(distPath));

// Redirect root to the app base path
app.get("/", (_req, res) => {
  res.redirect(APP_BASE + "/");
});

// SPA fallback: serve index.html for all app-base routes
app.get(`${APP_BASE}/*`, (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Rider Workbench Server running on http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/health`);
  console.log(`   Frontend: http://localhost:${PORT}${APP_BASE}/`);
});