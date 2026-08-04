import { db } from './db.js';

db.prepare("DELETE FROM user_settings").run();
db.prepare(`
  INSERT INTO user_settings
    (user_id, rider_name, monthly_goal, daily_goal, base_price, bonus_price, bonus_threshold, work_days_per_week, current_shift, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`).run('rider-user', 'Power', 1000, 40, 4.2, 4.5, 1500, 6, 'early_mid');

console.log('settings:', db.prepare('SELECT * FROM user_settings').all());
