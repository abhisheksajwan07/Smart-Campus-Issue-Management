export interface ComplaintBenchmarkPair {
  id: string;
  category: "Electrical" | "Plumbing" | "IT / Network" | "Hostel / Mess" | "Academic";
  queryA: string;
  queryB: string;
  isDuplicate: boolean; // Ground truth label
  description: string;
}

/**
 * Benchmark dataset of campus complaints for calibrating duplicate detection threshold.
 * Contains both positive pairs (semantically identical) and negative pairs (same category/room but different issues).
 */
export const COMPLAINT_BENCHMARK_DATASET: ComplaintBenchmarkPair[] = [
  // --- ELECTRICAL ---
  {
    id: "ELEC-DUP-1",
    category: "Electrical",
    queryA: "Ceiling fan making strange humming sound and stopped spinning in room 204",
    queryB: "Room 204 ceiling fan is broken and buzzing loudly not rotating",
    isDuplicate: true,
    description: "Same room, same broken fan with different phrasing",
  },
  {
    id: "ELEC-DUP-2",
    category: "Electrical",
    queryA: "Power socket sparking near study table in Tagore hostel room 112",
    queryB: "Spark coming from plug socket beside desk in Tagore hostel 112",
    isDuplicate: true,
    description: "Critical safety issue reported with identical meaning",
  },
  {
    id: "ELEC-NON-1",
    category: "Electrical",
    queryA: "Ceiling fan not working in room 204",
    queryB: "Ceiling fan not working in room 105",
    isDuplicate: false,
    description: "Same problem but completely different rooms (NOT a duplicate)",
  },
  {
    id: "ELEC-NON-2",
    category: "Electrical",
    queryA: "Ceiling fan not working in room 204",
    queryB: "Tube light is flickering and dead in room 204",
    isDuplicate: false,
    description: "Same room, but fan vs tube light are separate repairs",
  },

  // --- PLUMBING ---
  {
    id: "PLUMB-DUP-1",
    category: "Plumbing",
    queryA: "Water leaking heavily from wash basin pipe in 2nd floor common washroom",
    queryB: "Sink drainage pipe leakage flooding second floor bathroom",
    isDuplicate: true,
    description: "Same wash basin leak described with different words",
  },
  {
    id: "PLUMB-DUP-2",
    category: "Plumbing",
    queryA: "Tap in bathroom 301 is constantly dripping and won't shut tight",
    queryB: "Water tap dripping non-stop in room 301 washroom valve loose",
    isDuplicate: true,
    description: "Dripping tap in same room",
  },
  {
    id: "PLUMB-NON-1",
    category: "Plumbing",
    queryA: "No water in hostel taps on 3rd floor since morning",
    queryB: "Geyser not heating water in 1st floor washroom",
    isDuplicate: false,
    description: "Main line water outage vs specific geyser appliance issue",
  },
  {
    id: "PLUMB-NON-2",
    category: "Plumbing",
    queryA: "Wash basin drain clogged in 2nd floor washroom",
    queryB: "Toilet flush tank button broken in 2nd floor washroom",
    isDuplicate: false,
    description: "Same washroom, but basin clog vs toilet flush button",
  },

  // --- IT / NETWORK ---
  {
    id: "IT-DUP-1",
    category: "IT / Network",
    queryA: "WiFi connected but no internet access throughout Central Library 1st floor",
    queryB: "Internet not working on library first floor campus wifi network",
    isDuplicate: true,
    description: "Library Wi-Fi outage reported by two different students",
  },
  {
    id: "IT-DUP-2",
    category: "IT / Network",
    queryA: "Cannot log into GBU student ERP portal getting 500 internal server error",
    queryB: "ERP portal login page crashes with server error when submitting credentials",
    isDuplicate: true,
    description: "Student portal server crash",
  },
  {
    id: "IT-NON-1",
    category: "IT / Network",
    queryA: "WiFi connected but no internet in Central Library",
    queryB: "Projector in Seminar Hall 2 won't connect through HDMI cable",
    isDuplicate: false,
    description: "Network issue vs classroom AV hardware",
  },
  {
    id: "IT-NON-2",
    category: "IT / Network",
    queryA: "Forgot GBU student portal password need reset link",
    queryB: "LMS assignment portal giving submission timeout error",
    isDuplicate: false,
    description: "Password reset request vs LMS platform timeout",
  },

  // --- HOSTEL / MESS ---
  {
    id: "HOSTEL-DUP-1",
    category: "Hostel / Mess",
    queryA: "Mess dinner food quality is terrible and chapatis are undercooked today",
    queryB: "Dinner served in hostel mess was uncooked and bad quality tonight",
    isDuplicate: true,
    description: "Same meal quality complaint from different students",
  },
  {
    id: "HOSTEL-DUP-2",
    category: "Hostel / Mess",
    queryA: "Dustbins in corridor outside Block C are overflowing and not cleaned",
    queryB: "Hostel corridor trash cans not emptied in Block C foul smell",
    isDuplicate: true,
    description: "Sanitation hygiene complaint in hostel corridor",
  },
  {
    id: "HOSTEL-NON-1",
    category: "Hostel / Mess",
    queryA: "Mess dinner food quality is terrible today",
    queryB: "Water cooler on 2nd floor hostel corridor is not cooling water",
    isDuplicate: false,
    description: "Food complaint vs drinking water cooler hardware",
  },
  {
    id: "HOSTEL-NON-2",
    category: "Hostel / Mess",
    queryA: "Room lock jam in Tagore hostel 204 key not turning",
    queryB: "Window glass cracked in Tagore hostel room 204",
    isDuplicate: false,
    description: "Same room, but door lock vs window glass",
  },

  // --- ACADEMIC ---
  {
    id: "ACAD-DUP-1",
    category: "Academic",
    queryA: "5th semester marksheet has incorrect grade for Operating Systems CS301",
    queryB: "Wrong grade entered for CS301 Operating Systems in sem 5 mark sheet",
    isDuplicate: true,
    description: "Marksheet error for exact same course",
  },
  {
    id: "ACAD-NON-1",
    category: "Academic",
    queryA: "5th semester marksheet has incorrect grade for CS301",
    queryB: "Requesting bonafide certificate for passport application",
    isDuplicate: false,
    description: "Grade discrepancy vs certificate application",
  },
];
