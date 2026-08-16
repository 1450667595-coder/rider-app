export interface WeatherData {
  temperature: number;
  weatherCode: number;
  weatherLabel: string;
  weatherEmoji: string;
  windSpeed: number;
  humidity: number;
  forecast: WeatherForecastDay[];
  cityName?: string;
  source?: string;
}

export interface WeatherForecastDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  weatherLabel: string;
  weatherEmoji: string;
}

export interface ForecastSummary {
  dailyWeather: Array<{
    date: string;
    weatherType: "sunny" | "cloudy" | "rainy" | "snowy" | "windy";
    weatherLabel: string;
    weatherEmoji: string;
    maxTemp: number;
    minTemp: number;
  }>;
  temperatureTrend: "rising" | "falling" | "stable";
  rainProbability: number;
  bestWorkDay: { date: string; reason: string };
  worstWorkDay: { date: string; reason: string };
}

export interface TrendAnalysis {
  overallTrend: "warming" | "cooling" | "stable";
  precipitationTrend: "increasing" | "decreasing" | "none" | "stable";
  dailyPatterns: Array<{
    date: string;
    trend: string;
    changeFromPrevious: number;
  }>;
  significantChanges: Array<{
    date: string;
    description: string;
  }>;
}

export interface WeatherImpactScore {
  score: number;
  factors: {
    temperature: number;
    humidity: number;
    wind: number;
    weatherType: number;
    comfort: number;
  };
  recommendation: string;
}

// ═══════════════════════════════════════════════════
// 网络工具：带超时 + 重试的 fetch 封装
// ═══════════════════════════════════════════════════

interface FetchWithRetryOptions {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

const DEFAULT_FETCH_OPTIONS: Required<FetchWithRetryOptions> = {
  timeoutMs: 8000,
  maxRetries: 2,
  retryDelayMs: 400,
};

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  return Promise.race([
    fetch(url),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { timeoutMs, maxRetries, retryDelayMs } = { ...DEFAULT_FETCH_OPTIONS, ...options };
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, timeoutMs);
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    // 如果不是最后一次尝试，等一下再重试（指数退避）
    if (attempt < maxRetries) {
      const delay = retryDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Request failed");
}

// 对多个候选 URL 逐个尝试，直到找到一个可用的
async function tryFetchUrls(
  urls: string[],
  options: FetchWithRetryOptions = {}
): Promise<Response | null> {
  for (const url of urls) {
    try {
      const res = await fetchWithRetry(url, options);
      if (res?.ok) return res;
    } catch {
      // 继续下一个
    }
  }
  return null;
}

// WMO Weather Codes mapping（Open-Meteo 降级用）
const WMO_CODES: Record<number, { label: string; emoji: string }> = {
  0: { label: "晴天", emoji: "☀️" },
  1: { label: "大部晴", emoji: "🌤️" },
  2: { label: "多云", emoji: "⛅" },
  3: { label: "阴天", emoji: "☁️" },
  45: { label: "雾", emoji: "🌫️" },
  48: { label: "霜雾", emoji: "🌫️" },
  51: { label: "小毛毛雨", emoji: "🌦️" },
  53: { label: "毛毛雨", emoji: "🌦️" },
  55: { label: "大毛毛雨", emoji: "🌧️" },
  61: { label: "小雨", emoji: "🌧️" },
  63: { label: "中雨", emoji: "🌧️" },
  65: { label: "大雨", emoji: "🌧️" },
  71: { label: "小雪", emoji: "🌨️" },
  73: { label: "中雪", emoji: "🌨️" },
  75: { label: "大雪", emoji: "❄️" },
  77: { label: "雪粒", emoji: "🌨️" },
  80: { label: "阵雨", emoji: "⛈️" },
  81: { label: "中阵雨", emoji: "⛈️" },
  82: { label: "大阵雨", emoji: "⛈️" },
  85: { label: "小阵雪", emoji: "🌨️" },
  86: { label: "大阵雪", emoji: "❄️" },
  95: { label: "雷暴", emoji: "⛈️" },
  96: { label: "雷暴+小冰雹", emoji: "⛈️" },
  99: { label: "雷暴+大冰雹", emoji: "⛈️" },
};

function getWeatherInfo(code: number): { label: string; emoji: string } {
  return WMO_CODES[code] || { label: "未知", emoji: "🌡️" };
}

export function weatherCodeToOurWeather(code: number): "sunny" | "cloudy" | "rainy" | "snowy" | "windy" {
  if (code === 0 || code === 1) return "sunny";
  if (code === 2 || code === 3) return "cloudy";
  if (code >= 51 && code <= 65 || code >= 80 && code <= 82 || code >= 95) return "rainy";
  if (code >= 71 && code <= 77 || code === 85 || code === 86) return "snowy";
  return "windy";
}

// ═══════════════════════════════════════════════════
// 中国天气源：sojson.com（免费、JSON、无需 Key）
// ═══════════════════════════════════════════════════

/** 常见中国城市代码表（sojson.com） */
const CITY_CODE_MAP: Record<string, string> = {
  北京: "101010100",
  上海: "101020100",
  天津: "101030100",
  重庆: "101040100",
  哈尔滨: "101050101",
  齐齐哈尔: "101050201",
  牡丹江: "101050301",
  佳木斯: "101050401",
  绥化: "101050501",
  黑河: "101050601",
  大庆: "101050901",
  长春: "101060101",
  吉林: "101060201",
  四平: "101060301",
  延吉: "101060901",
  沈阳: "101070101",
  大连: "101070201",
  鞍山: "101070301",
  抚顺: "101070401",
  本溪: "101070501",
  丹东: "101070601",
  锦州: "101070701",
  营口: "101070801",
  阜新: "101070901",
  辽阳: "101071001",
  盘锦: "101071101",
  铁岭: "101071201",
  朝阳: "101071301",
  葫芦岛: "101071401",
  呼和浩特: "101080101",
  包头: "101080201",
  乌海: "101080301",
  赤峰: "101080601",
  通辽: "101080501",
  鄂尔多斯: "101080701",
  呼伦贝尔: "101081000",
  石家庄: "101090101",
  保定: "101090201",
  张家口: "101090301",
  承德: "101090402",
  唐山: "101090501",
  廊坊: "101090601",
  沧州: "101090701",
  衡水: "101090801",
  邢台: "101090901",
  邯郸: "101091001",
  秦皇岛: "101091101",
  太原: "101100101",
  大同: "101100201",
  阳泉: "101100301",
  长治: "101100501",
  晋城: "101100601",
  朔州: "101100901",
  晋中: "101100401",
  运城: "101100801",
  忻州: "101101001",
  临汾: "101100701",
  吕梁: "101101100",
  济南: "101120101",
  青岛: "101120201",
  淄博: "101120301",
  枣庄: "101121401",
  东营: "101121201",
  烟台: "101120501",
  潍坊: "101120601",
  济宁: "101120701",
  泰安: "101120801",
  威海: "101121001",
  日照: "101121501",
  临沂: "101120901",
  德州: "101120401",
  聊城: "101121601",
  滨州: "101121101",
  菏泽: "101121001",
  郑州: "101180101",
  开封: "101180801",
  洛阳: "101180901",
  平顶山: "101180501",
  安阳: "101180201",
  鹤壁: "101181201",
  新乡: "101180301",
  焦作: "101181101",
  濮阳: "101181301",
  许昌: "101180401",
  漯河: "101181501",
  三门峡: "101181701",
  南阳: "101180701",
  商丘: "101181001",
  信阳: "101180601",
  周口: "101181401",
  驻马店: "101181601",
  南京: "101190101",
  无锡: "101190201",
  徐州: "101190801",
  常州: "101191101",
  苏州: "101190401",
  南通: "101190501",
  连云港: "101191001",
  淮安: "101190901",
  盐城: "101190701",
  扬州: "101190601",
  镇江: "101190301",
  泰州: "101191201",
  宿迁: "101191301",
  杭州: "101210101",
  宁波: "101210401",
  温州: "101210701",
  嘉兴: "101210301",
  湖州: "101210201",
  绍兴: "101210501",
  金华: "101210901",
  衢州: "101211001",
  舟山: "101211101",
  台州: "101210601",
  丽水: "101210801",
  合肥: "101220101",
  芜湖: "101220301",
  蚌埠: "101220201",
  淮南: "101220401",
  马鞍山: "101220501",
  淮北: "101220601",
  铜陵: "101221301",
  安庆: "101220601",
  黄山: "101221001",
  滁州: "101221101",
  阜阳: "101220801",
  宿州: "101220701",
  六安: "101221501",
  亳州: "101220901",
  池州: "101221701",
  宣城: "101221401",
  福州: "101230101",
  厦门: "101230201",
  莆田: "101230401",
  三明: "101230801",
  泉州: "101230501",
  漳州: "101230601",
  南平: "101230901",
  龙岩: "101230701",
  宁德: "101230301",
  南昌: "101240101",
  景德镇: "101240801",
  萍乡: "101240901",
  九江: "101240201",
  新余: "101241001",
  鹰潭: "101241101",
  赣州: "101240701",
  吉安: "101240601",
  宜春: "101240501",
  抚州: "101240401",
  上饶: "101240301",
  武汉: "101200101",
  黄石: "101200601",
  十堰: "101201101",
  宜昌: "101200901",
  襄阳: "101200201",
  鄂州: "101200301",
  荆门: "101201401",
  孝感: "101200401",
  荆州: "101200801",
  黄冈: "101200501",
  咸宁: "101200701",
  随州: "101201301",
  恩施: "101201001",
  长沙: "101250101",
  株洲: "101250301",
  湘潭: "101250201",
  衡阳: "101250401",
  邵阳: "101250901",
  岳阳: "101251001",
  常德: "101250601",
  张家界: "101251101",
  益阳: "101250701",
  郴州: "101250501",
  永州: "101251401",
  怀化: "101251201",
  娄底: "101250801",
  广州: "101280101",
  韶关: "101280201",
  深圳: "101280601",
  珠海: "101280701",
  汕头: "101280501",
  佛山: "101280800",
  江门: "101281101",
  湛江: "101281001",
  茂名: "101282001",
  肇庆: "101280901",
  惠州: "101280301",
  梅州: "101280401",
  汕尾: "101282101",
  河源: "101281201",
  阳江: "101281801",
  清远: "101281301",
  东莞: "101281601",
  中山: "101281701",
  潮州: "101281901",
  揭阳: "101281901",
  云浮: "101281401",
  南宁: "101300101",
  柳州: "101300301",
  桂林: "101300501",
  梧州: "101300601",
  北海: "101301301",
  防城港: "101301401",
  钦州: "101301101",
  贵港: "101300801",
  玉林: "101300901",
  百色: "101301001",
  贺州: "101300701",
  河池: "101301201",
  来宾: "101300401",
  崇左: "101300201",
  海口: "101310101",
  三亚: "101310201",
  成都: "101270101",
  自贡: "101270301",
  攀枝花: "101270401",
  泸州: "101271001",
  德阳: "101272001",
  绵阳: "101270401",
  广元: "101272101",
  遂宁: "101270701",
  内江: "101271201",
  乐山: "101271601",
  南充: "101270501",
  眉山: "101271501",
  宜宾: "101271101",
  广安: "101270801",
  达州: "101270601",
  雅安: "101271701",
  巴中: "101270901",
  资阳: "101271301",
  贵阳: "101260101",
  六盘水: "101260801",
  遵义: "101260201",
  安顺: "101260301",
  昆明: "101290101",
  曲靖: "101290401",
  玉溪: "101290701",
  保山: "101290501",
  昭通: "101291001",
  丽江: "101290401",
  普洱: "101290901",
  临沧: "101290501",
  拉萨: "101140101",
  日喀则: "101140201",
  昌都: "101140501",
  林芝: "101140401",
  西安: "101110101",
  铜川: "101111001",
  宝鸡: "101110901",
  咸阳: "101110200",
  渭南: "101110501",
  延安: "101110300",
  汉中: "101110801",
  榆林: "101110401",
  安康: "101110701",
  商洛: "101110601",
  兰州: "101160101",
  嘉峪关: "101161401",
  金昌: "101160601",
  白银: "101161301",
  天水: "101160901",
  武威: "101160501",
  张掖: "101160201",
  平凉: "101160301",
  酒泉: "101160801",
  西宁: "101150101",
  海东: "101150301",
  银川: "101170101",
  石嘴山: "101170201",
  吴忠: "101170301",
  固原: "101170401",
  乌鲁木齐: "101130101",
  克拉玛依: "101130201",
  吐鲁番: "101130501",
  哈密: "101131201",
  香港: "101320101",
  澳门: "101330101",
  台北: "101340101",
  高雄: "101340201",
};

function normalizeCity(city: string): string {
  return city.replace(/[省市县区]/g, "").trim();
}

function getCityCode(city: string): string | undefined {
  const normalized = normalizeCity(city);
  return CITY_CODE_MAP[city] || CITY_CODE_MAP[normalized];
}

/** 将中国天气文字映射为内部 weather code（与 WMO 区间错开，避免冲突） */
const CN_TYPE_CODES: Record<string, number> = {
  晴: 0,
  多云: 2,
  阴: 3,
  晴间多云: 1,
  大部多云: 2,
  阵雨: 80,
  雷阵雨: 95,
  雷阵雨伴有冰雹: 96,
  小雨: 61,
  中雨: 63,
  大雨: 65,
  暴雨: 65,
  大暴雨: 65,
  特大暴雨: 65,
  雨夹雪: 71,
  阵雪: 85,
  小雪: 71,
  中雪: 73,
  大雪: 75,
  暴雪: 75,
  雾: 45,
  霾: 45,
  浮尘: 45,
  扬沙: 45,
  强沙尘暴: 45,
  风: 10,
};

function cnTypeToCode(type: string): number {
  // 优先完全匹配
  if (CN_TYPE_CODES[type] !== undefined) return CN_TYPE_CODES[type];
  // 模糊匹配
  for (const [key, code] of Object.entries(CN_TYPE_CODES)) {
    if (type.includes(key)) return code;
  }
  return 2; // 默认多云
}

function cnTypeToInfo(type: string): { label: string; emoji: string } {
  const code = cnTypeToCode(type);
  if (code === 0) return { label: "晴", emoji: "☀️" };
  if (code === 1) return { label: "大部晴", emoji: "🌤️" };
  if (code === 2) return { label: "多云", emoji: "⛅" };
  if (code === 3) return { label: "阴", emoji: "☁️" };
  if (code === 45) return { label: "雾/霾", emoji: "🌫️" };
  if (code === 61) return { label: "小雨", emoji: "🌧️" };
  if (code === 63) return { label: "中雨", emoji: "🌧️" };
  if (code === 65) return { label: "大雨", emoji: "🌧️" };
  if (code === 71) return { label: "小雪", emoji: "🌨️" };
  if (code === 73) return { label: "中雪", emoji: "🌨️" };
  if (code === 75) return { label: "大雪", emoji: "❄️" };
  if (code === 80) return { label: "阵雨", emoji: "⛈️" };
  if (code === 85) return { label: "阵雪", emoji: "🌨️" };
  if (code === 95) return { label: "雷阵雨", emoji: "⛈️" };
  if (code === 96) return { label: "雷暴+冰雹", emoji: "⛈️" };
  if (code === 10) return { label: "大风", emoji: "💨" };
  return { label: type || "多云", emoji: "⛅" };
}

function parseTemp(tempStr: string): number {
  const m = tempStr.match(/-?\d+/);
  return m ? Number(m[0]) : 0;
}

function parseWindLevel(flStr: string): number {
  if (!flStr) return 0;
  const text = flStr.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").replace(/[^\d-]/g, "");
  const nums = text.split("-").map((s) => Number(s)).filter((n) => !isNaN(n) && n > 0);
  if (nums.length === 0) return 0;
  // 返回风级区间最大值，用于保守评估骑行影响
  return Math.max(...nums);
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ═══════════════════════════════════════════════════
// 中国天气源：wthrcdn.etouch.cn（万年历，免费、JSON、无需 Key）
// ═══════════════════════════════════════════════════

interface WthrcdnForecastDay {
  date: string;
  high: string;
  low: string;
  fengxiang: string;
  fengli: string;
  type: string;
}

interface WthrcdnResponse {
  status: number;
  desc: string;
  data?: {
    city: string;
    wendu: string;
    forecast: WthrcdnForecastDay[];
  };
}

async function fetchWthrcdnWeather(city: string): Promise<WeatherData | null> {
  try {
    const encoded = encodeURIComponent(city);
    const apiBase = import.meta.env.VITE_API_URL || "";
    const urls = [
      `${apiBase}/api/weather/wthrcdn?city=${encoded}`,
      `https://wthrcdn.etouch.cn/weather_mini?city=${encoded}`,
      `http://wthrcdn.etouch.cn/weather_mini?city=${encoded}`,
    ];

    const res = await tryFetchUrls(urls);
    if (!res) return null;

    const json: WthrcdnResponse = await res.json();
    if (json.status !== 1000 || !json.data?.forecast?.length) return null;

    const baseDate = new Date();
    const forecast: WeatherForecastDay[] = json.data.forecast.slice(0, 7).map((day, i) => {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const info = cnTypeToInfo(day.type);
      return {
        date: formatYMD(d),
        maxTemp: parseTemp(day.high),
        minTemp: parseTemp(day.low),
        weatherCode: cnTypeToCode(day.type),
        weatherLabel: info.label,
        weatherEmoji: info.emoji,
      };
    });

    const today = forecast[0];
    const rawToday = json.data.forecast[0];
    const currentInfo = today ? cnTypeToInfo(today.weatherLabel) : { label: "多云", emoji: "⛅" };
    const currentTemp = Number(json.data.wendu) || today?.maxTemp || 20;

    return {
      temperature: Math.round(currentTemp),
      weatherCode: today ? today.weatherCode : cnTypeToCode("多云"),
      weatherLabel: currentInfo.label,
      weatherEmoji: currentInfo.emoji,
      windSpeed: rawToday ? parseWindLevel(rawToday.fengli) : 0,
      humidity: 50,
      forecast,
      cityName: json.data.city,
      source: "wthrcdn",
    };
  } catch {
    return null;
  }
}

interface SojsonResponse {
  status: number;
  cityInfo?: { city: string; citykey: string; updateTime: string };
  data?: {
    wendu: string;
    shidu: string;
    pm25: number;
    quality: string;
    forecast: Array<{
      date: string;
      high: string;
      low: string;
      ymd: string;
      week: string;
      fx: string;
      fl: string;
      type: string;
      notice: string;
      aqi: number;
    }>;
    yesterday?: {
      ymd: string;
      high: string;
      low: string;
      type: string;
    };
  };
}

async function fetchSojsonWeather(cityCode: string): Promise<WeatherData | null> {
  try {
    // 优先走同域代理，避免 HTTPS 页面请求 HTTP 源被浏览器拦截
    const apiBase = import.meta.env.VITE_API_URL || "";
    const proxyUrl = `${apiBase}/api/weather/city/${cityCode}`;
    const directUrl = `http://t.weather.sojson.com/api/weather/city/${cityCode}`;

    const res = await tryFetchUrls([proxyUrl, directUrl]);
    if (!res) return null;

    const json: SojsonResponse = await res.json();
    if (json.status !== 200 || !json.data) return null;

    const forecast = json.data.forecast.slice(0, 7).map((day) => {
      const info = cnTypeToInfo(day.type);
      return {
        date: day.ymd,
        maxTemp: parseTemp(day.high),
        minTemp: parseTemp(day.low),
        weatherCode: cnTypeToCode(day.type),
        weatherLabel: info.label,
        weatherEmoji: info.emoji,
      };
    });

    const today = forecast[0];
    const rawToday = json.data.forecast[0];
    const currentInfo = today ? cnTypeToInfo(today.weatherLabel) : { label: "多云", emoji: "⛅" };
    const currentTemp = Number(json.data.wendu) || today?.maxTemp || 20;
    const humidityStr = String(json.data.shidu || "50%").replace("%", "");
    const humidity = Number(humidityStr) || 50;
    const windSpeed = rawToday ? parseWindLevel(rawToday.fl) : 0;

    return {
      temperature: Math.round(currentTemp),
      weatherCode: today ? today.weatherCode : cnTypeToCode("多云"),
      weatherLabel: currentInfo.label,
      weatherEmoji: currentInfo.emoji,
      windSpeed,
      humidity,
      forecast,
      cityName: json.cityInfo?.city,
      source: "sojson",
    };
  } catch {
    return null;
  }
}

/** 通过城市名从中国源获取天气（更准确） */
export async function fetchWeatherByCity(city: string): Promise<WeatherData | null> {
  if (!city) return null;

  // 1. 优先中国源 wthrcdn.etouch.cn（中国天气网/万年历，数据较准且稳定）
  const wthrData = await fetchWthrcdnWeather(city);
  if (wthrData) return wthrData;

  // 2. 降级 sojson.com（需城市代码，部分时段不稳定）
  const cityCode = getCityCode(city);
  if (cityCode) {
    const sojsonData = await fetchSojsonWeather(cityCode);
    if (sojsonData) return sojsonData;
  }

  // 3. 降级 Open-Meteo（全球城市适用，中国地区精度一般）
  try {
    const cities = await searchCities(city);
    if (cities.length === 0) return null;
    const { lat, lon, name } = cities[0];
    const weather = await fetchWeatherByCoords(lat, lon);
    if (weather) {
      weather.cityName = name;
      weather.source = "open-meteo";
    }
    return weather;
  } catch {
    return null;
  }
}

// Open-Meteo API - free, no API key needed（坐标定位用）
export async function fetchWeatherByCoords(
  lat: number,
  lon: number
): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`;
    const res = await fetchWithRetry(url, { timeoutMs: 10000 });
    if (!res.ok) return null;
    const data = await res.json();

    const currentCode = data.current.weather_code;
    const info = getWeatherInfo(currentCode);

    const forecast: WeatherForecastDay[] = data.daily.time.map((date: string, i: number) => {
      const fc = getWeatherInfo(data.daily.weather_code[i]);
      return {
        date,
        maxTemp: Math.round(data.daily.temperature_2m_max[i]),
        minTemp: Math.round(data.daily.temperature_2m_min[i]),
        weatherCode: data.daily.weather_code[i],
        weatherLabel: fc.label,
        weatherEmoji: fc.emoji,
      };
    });

    return {
      temperature: Math.round(data.current.temperature_2m),
      weatherCode: currentCode,
      weatherLabel: info.label,
      weatherEmoji: info.emoji,
      windSpeed: Math.round(data.current.wind_speed_10m),
      humidity: data.current.relative_humidity_2m,
      forecast,
      source: "open-meteo",
    };
  } catch {
    return null;
  }
}

export interface CityResult {
  name: string;
  lat: number;
  lon: number;
  country?: string;
  admin1?: string;
}

export async function searchCities(city: string): Promise<CityResult[]> {
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=zh`;
    const geoRes = await fetchWithRetry(geoUrl, { timeoutMs: 5000, maxRetries: 1 });
    if (!geoRes.ok) return [];
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) return [];
    return geoData.results.map((r: Record<string, unknown>) => ({
      name: String(r.name),
      lat: Number(r.latitude),
      lon: Number(r.longitude),
      country: String(r.country || ""),
      admin1: String(r.admin1 || ""),
    }));
  } catch {
    return [];
  }
}

// Get user's location
export interface DateWeather {
  date: string;
  weatherCode: number;
  maxTemp: number;
  minTemp: number;
  weatherLabel: string;
  weatherEmoji: string;
  weatherType: "sunny" | "cloudy" | "rainy" | "snowy" | "windy";
}

/**
 * 获取指定日期的天气。
 * 如果传入 city 且在中国源支持范围内，优先使用中国源预报；
 * 否则回退 Open-Meteo（forecast / archive）。
 */
export async function fetchWeatherForDate(
  lat: number,
  lon: number,
  date: string,
  city?: string
): Promise<DateWeather | null> {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    // 今天和未来：优先中国源 wthrcdn，其次 sojson
    if (city && date >= todayStr) {
      const wthrData = await fetchWthrcdnWeather(city);
      if (wthrData) {
        const day = wthrData.forecast.find((d) => d.date === date);
        if (day) {
          return {
            date,
            weatherCode: day.weatherCode,
            maxTemp: day.maxTemp,
            minTemp: day.minTemp,
            weatherLabel: day.weatherLabel,
            weatherEmoji: day.weatherEmoji,
            weatherType: weatherCodeToOurWeather(day.weatherCode),
          };
        }
      }

      const cityCode = getCityCode(city);
      if (cityCode) {
        const sojsonData = await fetchSojsonWeather(cityCode);
        if (sojsonData) {
          const day = sojsonData.forecast.find((d) => d.date === date);
          if (day) {
            return {
              date,
              weatherCode: day.weatherCode,
              maxTemp: day.maxTemp,
              minTemp: day.minTemp,
              weatherLabel: day.weatherLabel,
              weatherEmoji: day.weatherEmoji,
              weatherType: weatherCodeToOurWeather(day.weatherCode),
            };
          }
        }
      }
    }

    // Open-Meteo fallback
    let data: { daily?: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] } };

    if (date >= todayStr) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${date}&end_date=${date}`;
      const res = await fetch(url);
      data = await res.json();
    } else {
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${date}&end_date=${date}`;
      const res = await fetch(url);
      data = await res.json();
    }

    if (!data.daily || !data.daily.time || data.daily.time.length === 0) return null;

    const idx = data.daily.time.indexOf(date);
    if (idx === -1) return null;

    const code = data.daily.weather_code[idx];
    const info = getWeatherInfo(code);
    return {
      date,
      weatherCode: code,
      maxTemp: Math.round(data.daily.temperature_2m_max[idx]),
      minTemp: Math.round(data.daily.temperature_2m_min[idx]),
      weatherLabel: info.label,
      weatherEmoji: info.emoji,
      weatherType: weatherCodeToOurWeather(code),
    };
  } catch {
    return null;
  }
}

// Get user's location
export function getUserLocation(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
    );
  });
}

// ---------------------------------------------------------------------------
// Enhanced weather functions
// ---------------------------------------------------------------------------

/** Estimate rain probability from WMO weather code（0–100） */
function estimateRainProbability(code: number): number {
  if (code === 0 || code === 1) return 0;
  if (code === 2) return 10;
  if (code === 3) return 20;
  if (code === 45 || code === 48) return 15;
  if (code === 51) return 40;
  if (code === 53) return 50;
  if (code === 55) return 60;
  if (code === 61) return 60;
  if (code === 63) return 75;
  if (code === 65) return 90;
  if (code === 71 || code === 73) return 30;
  if (code === 75 || code === 77) return 50;
  if (code === 80) return 70;
  if (code === 81) return 80;
  if (code === 82) return 95;
  if (code === 85 || code === 86) return 40;
  if (code === 95) return 85;
  if (code === 96) return 90;
  if (code === 99) return 100;
  return 0;
}

/** Score a single forecast day for "work suitability" (higher = better for work) */
function workDayScore(day: WeatherForecastDay): number {
  const type = weatherCodeToOurWeather(day.weatherCode);
  const avgTemp = (day.maxTemp + day.minTemp) / 2;

  let score = 50;

  // Weather type bonus
  if (type === "sunny") score += 30;
  else if (type === "cloudy") score += 15;
  else if (type === "rainy") score -= 25;
  else if (type === "snowy") score -= 20;
  else score -= 10;

  // Temperature bonus (sweet spot 18-25°C)
  if (avgTemp >= 18 && avgTemp <= 25) score += 20;
  else if (avgTemp >= 10 && avgTemp <= 32) score += 5;
  else score -= 15;

  return Math.max(0, Math.min(100, score));
}

/**
 * getWeatherForecastSummary – returns a summary of the upcoming 7-day weather
 */
export function getWeatherForecastSummary(weather: WeatherData): ForecastSummary {
  const { forecast } = weather;

  const dailyWeather = forecast.map((day) => ({
    date: day.date,
    weatherType: weatherCodeToOurWeather(day.weatherCode),
    weatherLabel: day.weatherLabel,
    weatherEmoji: day.weatherEmoji,
    maxTemp: day.maxTemp,
    minTemp: day.minTemp,
  }));

  // Temperature trend: compare first-half average vs second-half average
  const mid = Math.floor(forecast.length / 2);
  const firstHalfAvg = forecast.slice(0, mid).reduce((s, d) => s + (d.maxTemp + d.minTemp) / 2, 0) / mid;
  const secondHalfAvg = forecast.slice(mid).reduce((s, d) => s + (d.maxTemp + d.minTemp) / 2, 0) / (forecast.length - mid);
  const diff = secondHalfAvg - firstHalfAvg;
  let temperatureTrend: "rising" | "falling" | "stable";
  if (diff > 2) temperatureTrend = "rising";
  else if (diff < -2) temperatureTrend = "falling";
  else temperatureTrend = "stable";

  // Average rain probability across all forecast days
  const rainProbs = forecast.map((d) => estimateRainProbability(d.weatherCode));
  const rainProbability = Math.round(rainProbs.reduce((a, b) => a + b, 0) / rainProbs.length);

  // Best and worst work days
  const scored = forecast.map((day) => ({ day, score: workDayScore(day) }));
  const best = scored.reduce((a, b) => (a.score > b.score ? a : b));
  const worst = scored.reduce((a, b) => (a.score < b.score ? a : b));

  const bestReasons: string[] = [];
  if (weatherCodeToOurWeather(best.day.weatherCode) === "sunny") bestReasons.push("天气晴朗");
  if (best.day.maxTemp >= 18 && best.day.maxTemp <= 25) bestReasons.push("温度舒适");
  const worstReasons: string[] = [];
  if (weatherCodeToOurWeather(worst.day.weatherCode) === "rainy") worstReasons.push("有降雨");
  if (worst.day.maxTemp > 35) worstReasons.push("高温");
  if (worst.day.minTemp < 0) worstReasons.push("低温");

  return {
    dailyWeather,
    temperatureTrend,
    rainProbability,
    bestWorkDay: { date: best.day.date, reason: bestReasons.join("，") || "综合条件最佳" },
    worstWorkDay: { date: worst.day.date, reason: worstReasons.join("，") || "综合条件较差" },
  };
}

/**
 * weatherTrendAnalysis – analyzes weather patterns over the forecast period
 */
export function weatherTrendAnalysis(weather: WeatherData): TrendAnalysis {
  const { forecast } = weather;

  if (forecast.length < 2) {
    return {
      overallTrend: "stable",
      precipitationTrend: "none",
      dailyPatterns: [],
      significantChanges: [],
    };
  }

  const dailyPatterns: TrendAnalysis["dailyPatterns"] = [];
  const significantChanges: TrendAnalysis["significantChanges"] = [];

  for (let i = 1; i < forecast.length; i++) {
    const prevAvg = (forecast[i - 1].maxTemp + forecast[i - 1].minTemp) / 2;
    const currAvg = (forecast[i].maxTemp + forecast[i].minTemp) / 2;
    const change = Math.round((currAvg - prevAvg) * 10) / 10;

    let trend: string;
    if (change > 2) trend = "明显升温";
    else if (change > 0.5) trend = "小幅升温";
    else if (change < -2) trend = "明显降温";
    else if (change < -0.5) trend = "小幅降温";
    else trend = "稳定";

    dailyPatterns.push({
      date: forecast[i].date,
      trend,
      changeFromPrevious: change,
    });

    if (Math.abs(change) >= 3) {
      significantChanges.push({
        date: forecast[i].date,
        description: change > 0 ? `气温骤升 ${change}°C` : `气温骤降 ${Math.abs(change)}°C`,
      });
    }

    // Detect significant weather type shifts
    const prevType = weatherCodeToOurWeather(forecast[i - 1].weatherCode);
    const currType = weatherCodeToOurWeather(forecast[i].weatherCode);
    if (prevType !== currType) {
      const typeMap: Record<string, string> = {
        sunny: "晴", cloudy: "多云", rainy: "雨", snowy: "雪", windy: "风",
      };
      significantChanges.push({
        date: forecast[i].date,
        description: `天气由${typeMap[prevType]}转${typeMap[currType]}`,
      });
    }
  }

  // Overall temperature trend
  const firstAvg = (forecast[0].maxTemp + forecast[0].minTemp) / 2;
  const lastAvg = (forecast[forecast.length - 1].maxTemp + forecast[forecast.length - 1].minTemp) / 2;
  const totalChange = lastAvg - firstAvg;
  let overallTrend: TrendAnalysis["overallTrend"];
  if (totalChange > 2) overallTrend = "warming";
  else if (totalChange < -2) overallTrend = "cooling";
  else overallTrend = "stable";

  // Precipitation trend
  const rainCodes = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];
  const precipProbs = forecast.map((d) => (rainCodes.includes(d.weatherCode) ? 1 : 0));
  const firstHalfPrecip = precipProbs.slice(0, Math.floor(precipProbs.length / 2)).reduce((a, b) => a + b, 0);
  const secondHalfPrecip = precipProbs.slice(Math.floor(precipProbs.length / 2)).reduce((a, b) => a + b, 0);
  let precipitationTrend: TrendAnalysis["precipitationTrend"];
  if (secondHalfPrecip > firstHalfPrecip) precipitationTrend = "increasing";
  else if (secondHalfPrecip < firstHalfPrecip) precipitationTrend = "decreasing";
  else if (firstHalfPrecip === 0) precipitationTrend = "none";
  else precipitationTrend = "stable";

  return {
    overallTrend,
    precipitationTrend,
    dailyPatterns,
    significantChanges,
  };
}

/**
 * bindWeatherToRecord – auto-match today's weather to a data record
 */
export function bindWeatherToRecord<T extends Record<string, unknown>>(
  record: T,
  weather: WeatherData
): T & {
  weather: {
    temperature: number;
    weatherCode: number;
    weatherLabel: string;
    weatherEmoji: string;
    windSpeed: number;
    humidity: number;
    weatherType: "sunny" | "cloudy" | "rainy" | "snowy" | "windy";
  };
} {
  return {
    ...record,
    weather: {
      temperature: weather.temperature,
      weatherCode: weather.weatherCode,
      weatherLabel: weather.weatherLabel,
      weatherEmoji: weather.weatherEmoji,
      windSpeed: weather.windSpeed,
      humidity: weather.humidity,
      weatherType: weatherCodeToOurWeather(weather.weatherCode),
    },
  };
}

/**
 * getWeatherImpactScore – calculates a composite weather impact score (0–100)
 * Higher score = higher weather impact / more disruptive weather
 */
export function getWeatherImpactScore(weather: WeatherData): WeatherImpactScore {
  const { temperature, humidity, windSpeed, weatherCode } = weather;

  // Temperature factor (0–100): extreme temps have higher impact
  let temperatureFactor: number;
  if (temperature < 0) temperatureFactor = Math.min(100, Math.abs(temperature) * 5);
  else if (temperature > 35) temperatureFactor = Math.min(100, (temperature - 35) * 5);
  else if (temperature >= 18 && temperature <= 25) temperatureFactor = 0;
  else if (temperature > 25) temperatureFactor = (temperature - 25) * 5;
  else temperatureFactor = (18 - temperature) * 3;

  // Humidity factor (0–100)
  let humidityFactor: number;
  if (humidity >= 40 && humidity <= 60) humidityFactor = 0;
  else if (humidity > 60) humidityFactor = Math.min(100, (humidity - 60) * 2);
  else humidityFactor = (40 - humidity) * 1.5;

  // Wind factor (0–100)
  let windFactor: number;
  if (windSpeed <= 10) windFactor = 0;
  else if (windSpeed <= 20) windFactor = (windSpeed - 10) * 3;
  else if (windSpeed <= 40) windFactor = 30 + (windSpeed - 20) * 2;
  else windFactor = Math.min(100, 70 + (windSpeed - 40));

  // Weather type factor (0–100)
  let weatherTypeFactor: number;
  const type = weatherCodeToOurWeather(weatherCode);
  if (type === "sunny") weatherTypeFactor = 0;
  else if (type === "cloudy") weatherTypeFactor = 15;
  else if (type === "rainy") {
    if (weatherCode <= 55) weatherTypeFactor = 30;
    else if (weatherCode <= 65) weatherTypeFactor = 50;
    else weatherTypeFactor = 70;
  } else if (type === "snowy") {
    weatherTypeFactor = 40;
  } else {
    weatherTypeFactor = 25;
  }

  // Comfort factor: composite of all others
  const comfortFactor = Math.round(
    temperatureFactor * 0.35 + humidityFactor * 0.2 + windFactor * 0.15 + weatherTypeFactor * 0.3
  );

  // Composite score
  const score = Math.round(
    temperatureFactor * 0.25 +
    humidityFactor * 0.15 +
    windFactor * 0.15 +
    weatherTypeFactor * 0.25 +
    comfortFactor * 0.2
  );

  let recommendation: string;
  if (score <= 20) recommendation = "天气条件极佳，适合户外活动";
  else if (score <= 40) recommendation = "天气条件良好，正常活动不受影响";
  else if (score <= 60) recommendation = "天气条件一般，建议适当防护";
  else if (score <= 80) recommendation = "天气条件较差，减少户外活动";
  else recommendation = "天气恶劣，建议避免外出";

  return {
    score: Math.round(score),
    factors: {
      temperature: Math.round(temperatureFactor),
      humidity: Math.round(humidityFactor),
      wind: Math.round(windFactor),
      weatherType: Math.round(weatherTypeFactor),
      comfort: Math.round(comfortFactor),
    },
    recommendation,
  };
}
