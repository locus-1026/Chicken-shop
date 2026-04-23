// Maps each outlet's PIN to a Supabase auth account.
// Priya owns 2 outlets but one Supabase account — the UI picks which
// outlet view to show via the preferred-outlet-code stored in localStorage.

export type OutletLogin = {
  outletCode: string;
  pin: string;
  location: string;
  state: string;
  owner: string;
  email: string;
  password: string;
};

export const outletLogins: OutletLogin[] = [
  { outletCode: "CC-001", pin: "1001", location: "Sunway Pyramid, Petaling Jaya",   state: "Selangor",     owner: "Lim Chee Keong", email: "lim@jifanwang.my",    password: "coco1001" },
  { outletCode: "CC-002", pin: "1002", location: "Mid Valley Megamall, KL",          state: "Kuala Lumpur", owner: "Priya Nair",     email: "priya@jifanwang.my",  password: "coco1002" },
  { outletCode: "CC-003", pin: "1003", location: "Gurney Plaza, Georgetown",         state: "Penang",       owner: "Priya Nair",     email: "priya@jifanwang.my",  password: "coco1002" },
  { outletCode: "CC-004", pin: "1004", location: "Aeon Tebrau City, Johor Bahru",    state: "Johor",        owner: "Ahmad Fadzli",   email: "fadzli@jifanwang.my", password: "coco1004" },
  { outletCode: "CC-005", pin: "1005", location: "The Spring Bintawa, Kuching",      state: "Sarawak",      owner: "Kevin Ooi",      email: "kevin@jifanwang.my",  password: "coco1005" },
];

export const PREFERRED_CODE_KEY = "cc.preferredOutletCode";
