// The Gridiron Football League: 32 fictional clubs across two conferences.
// Cities are real so that climate, travel distance, and market size can drive
// the simulation; every club, nickname, and stadium is invented.

// climate: drives the weather model. 'dome' never has weather.
// market: 1 (small) .. 5 (huge). Feeds revenue and free-agent appeal.

export const CONFERENCES = {
  EMPIRE: { key: 'EMPIRE', name: 'Empire Conference', abbr: 'EC' },
  FRONTIER: { key: 'FRONTIER', name: 'Frontier Conference', abbr: 'FC' },
};

export const DIVISIONS = ['East', 'North', 'South', 'West'];

export const TEAM_DATA = [
  // --- Empire East ---
  { id: 'NYS', city: 'New York', name: 'Sentinels', abbr: 'NYS', conf: 'EMPIRE', div: 'East',
    colors: ['#0b2545', '#c8a951'], stadium: 'Harbor Field', climate: 'cold', turf: 'grass',
    capacity: 82500, market: 5, lat: 40.71, lon: -74.01 },
  { id: 'BOS', city: 'Boston', name: 'Minutemen', abbr: 'BOS', conf: 'EMPIRE', div: 'East',
    colors: ['#13293d', '#b23a48'], stadium: 'Revere Stadium', climate: 'cold', turf: 'turf',
    capacity: 68000, market: 4, lat: 42.36, lon: -71.06 },
  { id: 'PHI', city: 'Philadelphia', name: 'Ironsides', abbr: 'PHI', conf: 'EMPIRE', div: 'East',
    colors: ['#20423a', '#d6d6d6'], stadium: 'Constitution Yard', climate: 'temperate', turf: 'grass',
    capacity: 71000, market: 4, lat: 39.95, lon: -75.17 },
  { id: 'BAL', city: 'Baltimore', name: 'Watchmen', abbr: 'BAL', conf: 'EMPIRE', div: 'East',
    colors: ['#3d1a5b', '#f0a202'], stadium: 'Fort Henry Bowl', climate: 'temperate', turf: 'grass',
    capacity: 70500, market: 3, lat: 39.29, lon: -76.61 },

  // --- Empire North ---
  { id: 'PIT', city: 'Pittsburgh', name: 'Riveters', abbr: 'PIT', conf: 'EMPIRE', div: 'North',
    colors: ['#1c1c1c', '#f5c518'], stadium: 'Three Rivers Works', climate: 'cold', turf: 'grass',
    capacity: 67000, market: 3, lat: 40.44, lon: -79.99 },
  { id: 'CLE', city: 'Cleveland', name: 'Forge', abbr: 'CLE', conf: 'EMPIRE', div: 'North',
    colors: ['#7a3b12', '#e8752a'], stadium: 'Lakeside Foundry', climate: 'cold', turf: 'grass',
    capacity: 67800, market: 3, lat: 41.50, lon: -81.69 },
  { id: 'DET', city: 'Detroit', name: 'Vanguard', abbr: 'DET', conf: 'EMPIRE', div: 'North',
    colors: ['#0f4c81', '#9fb1bc'], stadium: 'Assembly Dome', climate: 'dome', turf: 'turf',
    capacity: 65500, market: 3, lat: 42.33, lon: -83.05 },
  { id: 'BUF', city: 'Buffalo', name: 'Blizzard', abbr: 'BUF', conf: 'EMPIRE', div: 'North',
    colors: ['#00507a', '#a8dadc'], stadium: 'Lake Erie Field', climate: 'frigid', turf: 'turf',
    capacity: 71000, market: 2, lat: 42.89, lon: -78.88 },

  // --- Empire South ---
  { id: 'NSH', city: 'Nashville', name: 'Stampede', abbr: 'NSH', conf: 'EMPIRE', div: 'South',
    colors: ['#1d3557', '#e07a5f'], stadium: 'Cumberland Grounds', climate: 'warm', turf: 'grass',
    capacity: 69000, market: 3, lat: 36.16, lon: -86.78 },
  { id: 'ATL', city: 'Atlanta', name: 'Firebirds', abbr: 'ATL', conf: 'EMPIRE', div: 'South',
    colors: ['#8b1e3f', '#f4a259'], stadium: 'Peachtree Dome', climate: 'dome', turf: 'turf',
    capacity: 73000, market: 4, lat: 33.75, lon: -84.39 },
  { id: 'CHA', city: 'Charlotte', name: 'Crown', abbr: 'CHA', conf: 'EMPIRE', div: 'South',
    colors: ['#005f73', '#e9d8a6'], stadium: 'Queen City Park', climate: 'warm', turf: 'grass',
    capacity: 74000, market: 3, lat: 35.23, lon: -80.84 },
  { id: 'MEM', city: 'Memphis', name: 'Riverkings', abbr: 'MEM', conf: 'EMPIRE', div: 'South',
    colors: ['#4a2545', '#d4af37'], stadium: 'Delta Stadium', climate: 'warm', turf: 'grass',
    capacity: 64000, market: 2, lat: 35.15, lon: -90.05 },

  // --- Empire West ---
  { id: 'DEN', city: 'Denver', name: 'Summit', abbr: 'DEN', conf: 'EMPIRE', div: 'West',
    colors: ['#22333b', '#f26419'], stadium: 'Mile High Rim', climate: 'cold', turf: 'grass',
    capacity: 76000, market: 3, lat: 39.74, lon: -104.99, altitude: 5280 },
  { id: 'LV', city: 'Las Vegas', name: 'Aces', abbr: 'LV', conf: 'EMPIRE', div: 'West',
    colors: ['#0d0d0d', '#c0c0c0'], stadium: 'The Vault', climate: 'dome', turf: 'turf',
    capacity: 65000, market: 3, lat: 36.17, lon: -115.14 },
  { id: 'OAK', city: 'Oakland', name: 'Dockers', abbr: 'OAK', conf: 'EMPIRE', div: 'West',
    colors: ['#2f3e46', '#84a98c'], stadium: 'Port Authority Field', climate: 'temperate', turf: 'grass',
    capacity: 62000, market: 4, lat: 37.80, lon: -122.27 },
  { id: 'SEA', city: 'Seattle', name: 'Monarchs', abbr: 'SEA', conf: 'EMPIRE', div: 'West',
    colors: ['#1b4332', '#95d5b2'], stadium: 'Rainier Bowl', climate: 'rainy', turf: 'turf',
    capacity: 69000, market: 4, lat: 47.61, lon: -122.33 },

  // --- Frontier East ---
  { id: 'WAS', city: 'Washington', name: 'Federals', abbr: 'WAS', conf: 'FRONTIER', div: 'East',
    colors: ['#6b2737', '#e0c097'], stadium: 'Potomac Coliseum', climate: 'temperate', turf: 'grass',
    capacity: 78000, market: 4, lat: 38.91, lon: -77.04 },
  { id: 'MIA', city: 'Miami', name: 'Tarpons', abbr: 'MIA', conf: 'FRONTIER', div: 'East',
    colors: ['#00a5cf', '#f79824'], stadium: 'Biscayne Field', climate: 'hot', turf: 'grass',
    capacity: 65000, market: 4, lat: 25.76, lon: -80.19 },
  { id: 'TB', city: 'Tampa Bay', name: 'Corsairs', abbr: 'TB', conf: 'FRONTIER', div: 'East',
    colors: ['#2b2d42', '#ef233c'], stadium: 'Gasparilla Park', climate: 'hot', turf: 'grass',
    capacity: 66000, market: 3, lat: 27.95, lon: -82.46 },
  { id: 'ORL', city: 'Orlando', name: 'Comets', abbr: 'ORL', conf: 'FRONTIER', div: 'East',
    colors: ['#3a0ca3', '#4cc9f0'], stadium: 'Citrus Dome', climate: 'dome', turf: 'turf',
    capacity: 63000, market: 3, lat: 28.54, lon: -81.38 },

  // --- Frontier North ---
  { id: 'CHI', city: 'Chicago', name: 'Windriders', abbr: 'CHI', conf: 'FRONTIER', div: 'North',
    colors: ['#14213d', '#fca311'], stadium: 'Lakefront Stadium', climate: 'frigid', turf: 'grass',
    capacity: 72000, market: 5, lat: 41.88, lon: -87.63 },
  { id: 'GB', city: 'Green Bay', name: 'Lumberjacks', abbr: 'GB', conf: 'FRONTIER', div: 'North',
    colors: ['#344e41', '#dda15e'], stadium: 'Timber Bowl', climate: 'frigid', turf: 'grass',
    capacity: 79000, market: 1, lat: 44.51, lon: -88.02 },
  { id: 'MIN', city: 'Minnesota', name: 'Frost', abbr: 'MIN', conf: 'FRONTIER', div: 'North',
    colors: ['#3d348b', '#e6e6ea'], stadium: 'North Star Dome', climate: 'dome', turf: 'turf',
    capacity: 66500, market: 3, lat: 44.98, lon: -93.27 },
  { id: 'STL', city: 'St. Louis', name: 'Gateway', abbr: 'STL', conf: 'FRONTIER', div: 'North',
    colors: ['#8d0801', '#bfd7ea'], stadium: 'Arch Grounds', climate: 'temperate', turf: 'grass',
    capacity: 64500, market: 3, lat: 38.63, lon: -90.20 },

  // --- Frontier South ---
  { id: 'DAL', city: 'Dallas', name: 'Wranglers', abbr: 'DAL', conf: 'FRONTIER', div: 'South',
    colors: ['#003049', '#c1c8cd'], stadium: 'Lone Star Dome', climate: 'dome', turf: 'turf',
    capacity: 85000, market: 5, lat: 32.78, lon: -96.80 },
  { id: 'HOU', city: 'Houston', name: 'Wildcatters', abbr: 'HOU', conf: 'FRONTIER', div: 'South',
    colors: ['#1b263b', '#e5383b'], stadium: 'Derrick Field', climate: 'dome', turf: 'turf',
    capacity: 72000, market: 5, lat: 29.76, lon: -95.37 },
  { id: 'NO', city: 'New Orleans', name: 'Krewe', abbr: 'NO', conf: 'FRONTIER', div: 'South',
    colors: ['#5f0f40', '#fdd85d'], stadium: 'Crescent Dome', climate: 'dome', turf: 'turf',
    capacity: 73500, market: 2, lat: 29.95, lon: -90.07 },
  { id: 'SA', city: 'San Antonio', name: 'Vaqueros', abbr: 'SA', conf: 'FRONTIER', div: 'South',
    colors: ['#6a4c93', '#f0a202'], stadium: 'Riverwalk Stadium', climate: 'hot', turf: 'grass',
    capacity: 65000, market: 3, lat: 29.42, lon: -98.49 },

  // --- Frontier West ---
  { id: 'LA', city: 'Los Angeles', name: 'Stars', abbr: 'LA', conf: 'FRONTIER', div: 'West',
    colors: ['#0a2472', '#ffd60a'], stadium: 'Pacific Coliseum', climate: 'warm', turf: 'grass',
    capacity: 77000, market: 5, lat: 34.05, lon: -118.24 },
  { id: 'SF', city: 'San Francisco', name: 'Quake', abbr: 'SF', conf: 'FRONTIER', div: 'West',
    colors: ['#9d0208', '#dda15e'], stadium: 'Golden Gate Park', climate: 'temperate', turf: 'grass',
    capacity: 68500, market: 5, lat: 37.77, lon: -122.42 },
  { id: 'PHX', city: 'Phoenix', name: 'Scorpions', abbr: 'PHX', conf: 'FRONTIER', div: 'West',
    colors: ['#7b2d26', '#f2b705'], stadium: 'Sonoran Dome', climate: 'dome', turf: 'turf',
    capacity: 63500, market: 4, lat: 33.45, lon: -112.07 },
  { id: 'POR', city: 'Portland', name: 'Pioneers', abbr: 'POR', conf: 'FRONTIER', div: 'West',
    colors: ['#2d6a4f', '#b7e4c7'], stadium: 'Cascade Field', climate: 'rainy', turf: 'turf',
    capacity: 61000, market: 3, lat: 45.52, lon: -122.68 },
];

export const TEAM_IDS = TEAM_DATA.map((t) => t.id);
export const TEAM_BY_ID = Object.fromEntries(TEAM_DATA.map((t) => [t.id, t]));

export function divisionTeams(conf, div) {
  return TEAM_DATA.filter((t) => t.conf === conf && t.div === div);
}

export function conferenceTeams(conf) {
  return TEAM_DATA.filter((t) => t.conf === conf);
}

// Great-circle distance in miles. Used for travel fatigue and body-clock games.
export function travelMiles(a, b) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const LEAGUE_NAME = 'Gridiron Football League';
export const LEAGUE_ABBR = 'GFL';
export const CHAMPIONSHIP_NAME = 'Gridiron Bowl';
