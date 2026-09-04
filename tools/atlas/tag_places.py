"""Write src/data/atlas/places.gameplay.json — what the game makes of the atlas.

    python3 tools/atlas/tag_places.py
    npx prettier --write src/data/atlas   # this writes compact JSON; the repo does not

The atlas itself is never touched. This reads night-city.json and writes the
house-rule file beside it: a district profile for each of the 24 districts and
gameplay tags for each of the 156 locations.

TAGS ARE DRAFTED FROM THE PRINTED BLURB, AND DRAFTS ARE WRONG
Matching runs on the blurb only. Names are traps: the Garden of Earthly
Delights is a brothel, the Albino Alligator Carwash is a gang house, and a rule
that reads names turns both into something else. Even on blurbs the machine
mistakes a hospital "housing some of the best medical staff" for housing and a
campus "built up into something of a fortified monastery" for a church, so
every place it reads wrongly is answered by hand in PATCH below. Rancho
Coronado is authored outright: it is the district the first slice is played in.

Re-running this file reproduces the JSON exactly. Edit the rules or the patch
table here rather than the JSON, or the next run will quietly undo the edit.
"""
import json, re, collections

# Ordered by how much each tag says about what can happen there. Ties are
# broken by this order when a blurb matches more than the cap.
RULES = [
    ("ripperdoc",   r"ripperdoc|cyberware|implant|body ?shop"),
    ("hospital",    r"hospital|medical cent|trauma team|emergency room"),
    ("clinic",      r"\bclinic|medtech|infirmary"),
    ("market",      r"\bmarket\b|bazaar|swap meet"),
    ("fence",       r"black market|smuggl|stolen goods|contraband"),
    ("gang_turf",   r"\bgang\b|booster|maelstrom|tyger|valentino|6th street|voodoo|scav|claws|alligators|vaqueros|turf"),
    ("nomad",       r"nomad|aldecaldo|convoy"),
    ("police",      r"police|ncpd|precinct"),
    ("government",  r"city hall|council|courthouse|municipal|government|embassy|prison"),
    ("religious",   r"church|temple|shrine|cathedral|mosque|chapel|monaster"),
    ("school",      r"school|university|campus|college|academy|students"),
    ("stadium",     r"stadium|arena|coliseum|racetrack|sports"),
    ("transit",     r"\bstation\b|terminal|airport|transit|\brail|subway|heliport|ncart"),
    ("docks",       r"\bdocks?\b|\bpier\b|wharf|harbou?r|marina|shipyard|freighter|vessel"),
    ("farm",        r"\bfarm|growing bed|greenhouse|hydroponic|orchard|reclaimer|gardening"),
    ("lab",         r"\blab\b|laborator|research|biotechnica"),
    ("factory",     r"factory|refinery|foundry|ironworks|manufactur|industrial"),
    ("warehouse",   r"warehouse|storage|cargo|depot|distribution"),
    ("garage",      r"garage|car ?wash|mechanic|chop shop|vehicle"),
    ("repair",      r"repair|workshop|armorer|gunsmith|tailor"),
    ("studio",      r"studio|record label|gallery|theat(er|re)|cinema|museum|performance|symphony|concert"),
    ("media",       r"\bnews|broadcast|network|screamsheet|\bmedia\b"),
    ("club",        r"\bclub\b|nightclub|discotheque|dance hall"),
    ("bar",         r"\bbar\b|\bpub\b|tavern|\bdive\b|brewery|saloon|beer\b|pool hall"),
    ("restaurant",  r"restaurant|diner|eatery|steakhouse|noodle|caf[eé]|bistro"),
    ("food",        r"\bfood\b|\bmeal|cuisine|serves|dining|grocer|kibble|butcher"),
    ("leisure",     r"brothel|escort|\bspa\b|bathhouse|casino|gambl|hedonis|pool hall|amusement"),
    ("hotel",       r"hotel|motel|hostel|coffin|lodging"),
    ("shop",        r"\bshop\b|\bstore\b|retail|boutique|\bmall\b|supermarket|pawn|dealership"),
    ("bank",        r"\bbank\b|credit union"),
    ("corp_hq",     r"headquarters|night city hq\b"),
    ("office",      r"office|corporate|\bfirm\b|\bagency\b"),
    ("container_housing", r"cargo container (housing|communit|home)|shipping container|container communit|microvillage|\bcube\b"),
    ("luxury_housing", r"luxur|penthouse|gated|exclusive|upscale|estate\b"),
    ("flophouse",   r"flophouse|squat|slum|cheap (room|housing)"),
    ("housing",     r"housing|apartment|residen|tenement|condo|megabuilding|bungalow"),
    ("water",       r"\bbay\b|canal|reservoir|waterfront|lagoon"),
    ("rooftop",     r"rooftop|\broof\b"),
    ("park",        r"\bpark\b|plaza|promenade|\bbeach\b|\bzoo\b"),
    ("derelict",    r"abandoned|\bruin|\bhusk\b|condemned|collapsed|burned out|deserted|rubble|empty"),
    ("secure",      r"secure|fortified|guarded|checkpoint|walled|heavily armed"),
    ("crowd",       r"crowd|popular|packed|tourist|premiere|famous|legendary|institution"),
]
TAG_ORDER = [t for t, _ in RULES]
MAX_TAGS = 4

# Hand-authored. The slice district is written outright; the rest are places
# whose blurb does not describe what the place IS, or where the draft was wrong.
PATCH = {
    # Rancho Coronado — the vertical slice, authored rather than inferred.
    "x1": ["garage", "water", "gang_turf", "shop"],
    "x2": ["housing", "container_housing", "derelict"],
    "x3": ["container_housing", "stadium", "crowd"],
    "x4": ["farm", "food", "rooftop"],
    "x5": ["market", "derelict", "farm", "fence"],
    # Blurbs that describe a reputation rather than a function.
    "a8": ["bar", "leisure", "crowd"],
    "a13": ["shop", "repair"],
    "b4": ["leisure", "restaurant"],
    "b10": ["leisure", "shop"],
    "e4": ["office", "crowd"],
    "f3": ["studio", "crowd"],
    "v5": ["bar", "food"],
    # "Home base for X" is a headquarters for a gang or a courier outfit, not a corp.
    "u1": ["docks", "derelict", "housing"],
    "u3": ["factory", "garage", "shop"],
    # Blurbs that name what a place does without ever naming the kind of place.
    "a6": ["office", "corp_hq", "secure"],
    "b7": ["housing", "docks", "water"],
    "b11": ["office", "clinic"],
    "d3": ["repair", "shop", "secure"],
    "g5": ["police", "secure"],
    "h6": ["hotel", "container_housing", "flophouse"],
    "p7": ["government", "secure"],
    "q4": ["park", "religious", "luxury_housing"],
    "t10": ["club", "stadium", "crowd"],
    "v2": ["police"],
    # Blurbs the machine read as the wrong part of speech, or as literal where
    # the atlas was being figurative: a hospital "housing" staff is not housing,
    # and a campus "built up into something of a fortified monastery" is a
    # university. A "body bank" is not a bank.
    "a10": ["restaurant", "food"],
    "b3": ["hospital"],
    "b8": ["hotel", "container_housing"],
    "b13": ["corp_hq", "office"],
    "c2": ["corp_hq", "shop", "food"],
    "c3": ["office", "studio"],
    "f4": ["school", "secure", "crowd"],
    "j1": ["shop", "market"],
    "j5": ["ripperdoc", "fence"],
    "k1": ["religious"],
    "l2": ["bar", "restaurant", "food"],
    "m2": ["corp_hq", "office", "secure"],
    "n4": ["corp_hq", "office", "secure", "studio"],
    "n13": ["hotel", "container_housing"],
    "o1": ["studio", "crowd", "gang_turf"],
    "p4": ["hotel", "container_housing", "housing"],
    "q2": ["club", "crowd"],
    "t2": ["gang_turf", "corp_hq", "shop"],
    "t9": ["housing", "shop", "food"],
    "u5": ["container_housing", "housing", "office"],
    "v4": ["housing"],
    "v7": ["garage", "market", "nomad", "crowd"],
    "w3": ["restaurant", "food", "crowd"],
}


atlas = json.load(open("src/data/atlas/night-city.json"))


def draft_tags() -> dict[str, list[str]]:
    """Tags for every location: authored where PATCH answers, drafted otherwise."""
    out = {}
    for district in atlas["districts"]:
        for place in district["locations"]:
            if place["key"] in PATCH:
                out[place["key"]] = PATCH[place["key"]]
                continue
            hit = [t for t, pat in RULES if re.search(pat, place["blurb"].lower())]
            out[place["key"]] = sorted(hit, key=TAG_ORDER.index)[:MAX_TAGS]
    return out


tags = draft_tags()

DISTRICTS = {
    "little_europe":         ("prompt",    "mixed", "steady"),
    "upper_marina":          ("prompt",    "rich",  "busy"),
    "downtown":              ("immediate", "rich",  "busy"),
    "the_hot_zone":          ("none",      "poor",  "empty"),
    "little_china":          ("prompt",    "mixed", "busy"),
    "university_district":   ("prompt",    "mixed", "busy"),
    "the_glen":              ("prompt",    "rich",  "busy"),
    "old_japantown":         ("prompt",    "mixed", "steady"),
    "south_night_city":      ("slow",      "poor",  "steady"),
    "port_of_night_city":    ("prompt",    "mixed", "steady"),
    "reclamation_zone":      ("slow",      "poor",  "empty"),
    "old_combat_zone":       ("slow",      "poor",  "empty"),
    "norcal_military_base":  ("immediate", "mixed", "empty"),
    "watson_development":    ("prompt",    "mixed", "busy"),
    "kabuki":                ("prompt",    "mixed", "busy"),
    "new_westbrook":         ("prompt",    "rich",  "steady"),
    "charter_hill":          ("immediate", "rich",  "steady"),
    "exec_zone":             ("immediate", "rich",  "empty"),
    "heywood_docks":         ("slow",      "poor",  "steady"),
    "north_heywood":         ("slow",      "mixed", "busy"),
    "heywood_industrial_zone": ("slow",    "poor",  "steady"),
    "santo_domingo":         ("slow",      "poor",  "steady"),
    "pacifica_playground":   ("prompt",    "mixed", "busy"),
    "rancho_coronado":       ("none",      "poor",  "steady"),
}

keys = [d["key"] for d in atlas["districts"]]
assert set(keys) == set(DISTRICTS), set(keys) ^ set(DISTRICTS)

TAG_MEANINGS = {
    "market": "a market, formal or otherwise, where things change hands in the open",
    "fence": "somewhere the provenance of a thing is nobody's business",
    "shop": "a counter you can buy across",
    "bank": "money, held for other people",
    "bar": "somewhere to drink and be seen drinking",
    "club": "music, a door, and a reason to be let through it",
    "restaurant": "a sit-down meal",
    "food": "something to eat, at any price",
    "leisure": "somewhere people go to spend money on being pleased",
    "hotel": "a bed for the night, rented",
    "housing": "people live here",
    "luxury_housing": "people live here, and it cost them",
    "container_housing": "people live here, in what used to be freight",
    "flophouse": "people sleep here, which is not the same thing",
    "clinic": "someone who can close a wound",
    "hospital": "a real medical facility with a real bill",
    "ripperdoc": "chrome, installed",
    "garage": "vehicles, and the people who keep them running",
    "repair": "something broken can be made less broken",
    "warehouse": "goods, stacked, in quantity",
    "docks": "the water's edge, working",
    "factory": "things are made here",
    "office": "somebody's desks",
    "corp_hq": "a corporation's own front door",
    "lab": "research, and whatever it is researching",
    "farm": "food grown rather than shipped",
    "studio": "art, performance, or the making of either",
    "media": "the city talks to itself from here",
    "school": "somewhere people are taught",
    "stadium": "a venue built for a crowd",
    "park": "open ground the city left alone",
    "religious": "the sacred, and the dead",
    "government": "the city, acting as itself",
    "police": "law, with a building",
    "transit": "how people get in and out",
    "crowd": "reliably busy with people",
    "derelict": "abandoned, or most of the way there",
    "secure": "getting in is a problem to be solved",
    "gang_turf": "somebody claims this ground",
    "nomad": "nomad families, and their business",
    "water": "the waterfront, or water itself",
    "rooftop": "the action here is above street level",
}

# First match wins, so the most specific ground is named first.
ARENA_BY_TAG = [
    ["club", "club_interior"],
    ["bar", "club_interior"],
    ["restaurant", "club_interior"],
    ["warehouse", "warehouse"],
    ["factory", "warehouse"],
    ["docks", "warehouse"],
    ["garage", "parking_structure"],
    ["transit", "parking_structure"],
    ["rooftop", "rooftop"],
    ["market", "street"],
    ["shop", "street"],
    ["crowd", "street"],
    ["derelict", "alley"],
    ["flophouse", "alley"],
    ["housing", "alley"],
    ["farm", "open_ground"],
    ["park", "open_ground"],
    ["stadium", "open_ground"],
]

out = {
    "houseRule": True,
    "note": (
        "Gameplay metadata for the Night City Atlas. Every key here names a district or "
        "location in night-city.json and nothing here changes what that file says. The atlas "
        "is what the publisher printed; this is what the game makes of it, so it is tuned "
        "here rather than in code."
    ),
    "responseNote": (
        "Who comes when the street notices you. Read off each district's printed security "
        "provider: heat is scaled by the tier, so being loud in the Exec Zone costs what being "
        "loud in Rancho Coronado does not. The tiers and their multipliers are app pacing "
        "numbers, not Cyberpunk RED rules values."
    ),
    "responseTiers": {
        "none":      {"label": "nobody comes",      "heat": 0,   "minutes": 0},
        "slow":      {"label": "eventually",        "heat": 0.5, "minutes": 25},
        "prompt":    {"label": "before you finish", "heat": 1,   "minutes": 10},
        "immediate": {"label": "at once",           "heat": 2,   "minutes": 4},
    },
    "tags": TAG_MEANINGS,
    "arenaByTag": ARENA_BY_TAG,
    "districts": {},
    "places": {},
}

for d in atlas["districts"]:
    response, wealth, crowd = DISTRICTS[d["key"]]
    out["districts"][d["key"]] = {"response": response, "wealth": wealth, "crowd": crowd}

for d in atlas["districts"]:
    for l in d["locations"]:
        out["places"][l["key"]] = {"tags": tags[l["key"]]}

json.dump(out, open("src/data/atlas/places.gameplay.json", "w"), indent=2, ensure_ascii=False)
print("districts", len(out["districts"]), "places", len(out["places"]))
c = collections.Counter(t for p in out["places"].values() for t in p["tags"])
print("tags used", len(c), "of", len(TAG_MEANINGS))
print("unused:", sorted(set(TAG_MEANINGS) - set(c)) or "none")

untagged = [k for k, v in out["places"].items() if not v["tags"]]
unused = sorted(set(TAG_MEANINGS) - {t for p in out["places"].values() for t in p["tags"]})
assert not untagged, f"no tags for {untagged}"
assert not unused, f"tags nothing carries: {unused}"
