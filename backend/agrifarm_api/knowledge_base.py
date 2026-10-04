"""Fixed list of advisor answers (Swahili + English).

DEMO CONTENT: written for the hackathon, NOT yet reviewed by an agronomist or a native
Swahili speaker. Answers are deliberately conservative: describe, suggest a safe step,
and send the farmer to a person before anything costly or irreversible.
"""

REVIEW_STATUS = "demo content: agronomist and Swahili review pending"

ENTRIES = [
    {
        "id": "COFFEE_LEAF_RUST", "crop": "coffee",
        "keywords": ["rust", "orange", "powder", "spots", "leaf", "leaves", "coffee",
                     "kutu", "machungwa", "unga", "madoa", "jani", "majani", "kahawa"],
        "en": "Orange, powdery spots under coffee leaves can be coffee leaf rust. Put a few affected leaves in a bag "
              "and show the extension officer or your cooperative before spraying anything.",
        "sw": "Madoa ya unga wa rangi ya machungwa chini ya majani ya kahawa yanaweza kuwa kutu ya majani. Weka majani "
              "machache yaliyoathirika kwenye mfuko na umwonyeshe afisa ugani au chama kabla ya kunyunyiza dawa yoyote.",
    },
    {
        "id": "COFFEE_BERRY_DISEASE", "crop": "coffee",
        "keywords": ["berry", "berries", "black", "dark", "rotting", "cherries", "coffee",
                     "buni", "matunda", "meusi", "kuoza", "kahawa"],
        "en": "Dark, sunken spots on green coffee berries can be coffee berry disease. Keep a few affected berries and "
              "ask the extension officer to confirm before buying any chemical.",
        "sw": "Madoa meusi yaliyobonyea kwenye matunda mabichi ya kahawa yanaweza kuwa ugonjwa wa buni. Hifadhi matunda "
              "machache yaliyoathirika na umwombe afisa ugani athibitishe kabla ya kununua dawa.",
    },
    {
        "id": "COFFEE_BERRY_BORER", "crop": "coffee",
        "keywords": ["hole", "holes", "insect", "borer", "beetle", "berry", "berries",
                     "tundu", "kidudu", "wadudu", "toboa", "matunda"],
        "en": "A small round hole in coffee berries can mean berry borer. Collect fallen and dry berries from the ground "
              "and show a sample to the extension officer.",
        "sw": "Tundu dogo la duara kwenye matunda ya kahawa linaweza kuwa mdudu wa kutoboa buni. Okota matunda "
              "yaliyoanguka na makavu na umwonyeshe afisa ugani sampuli.",
    },
    {
        "id": "MAIZE_ARMYWORM", "crop": "maize",
        "keywords": ["worm", "worms", "caterpillar", "eaten", "holes", "maize", "corn",
                     "viwavi", "viwavijeshi", "funza", "mahindi", "yameliwa"],
        "en": "Ragged holes in young maize leaves with small caterpillars can be fall armyworm. Check the centre of the "
              "plant early in the morning and ask the extension officer to confirm before spraying.",
        "sw": "Matundu yasiyo sawa kwenye majani machanga ya mahindi pamoja na viwavi wadogo yanaweza kuwa viwavijeshi. "
              "Kagua katikati ya mmea asubuhi na mapema na umwombe afisa ugani athibitishe kabla ya kunyunyiza.",
    },
    {
        "id": "PARCHMENT_DRYING", "crop": "coffee",
        "keywords": ["dry", "drying", "moisture", "parchment", "wet", "sun",
                     "kukausha", "kausha", "unyevu", "maganda", "jua"],
        "en": "Dry parchment on raised tables or tarpaulins, not bare ground, and cover it at night and in rain. Ask "
              "your cooperative to test the moisture before you sell.",
        "sw": "Kausha kahawa ya maganda juu ya meza au turubai, si ardhini, na uifunike usiku na wakati wa mvua. Omba "
              "chama chako kipime unyevu kabla ya kuuza.",
    },
    {
        "id": "STORAGE", "crop": None,
        "keywords": ["store", "storage", "sack", "sacks", "rats", "mould", "mold",
                     "hifadhi", "kuhifadhi", "gunia", "magunia", "panya", "ukungu"],
        "en": "Store dry produce in clean sacks raised off the floor, away from walls, and check every week for mould "
              "or pests.",
        "sw": "Hifadhi mazao makavu kwenye magunia safi yaliyoinuliwa kutoka sakafuni, mbali na ukuta, na ukague kila "
              "wiki kuona ukungu au wadudu.",
    },
    {
        "id": "FAKE_INPUTS", "crop": None,
        "keywords": ["fake", "counterfeit", "genuine", "seed", "seeds", "fertilizer", "fertiliser", "pesticide",
                     "bandia", "feki", "mbegu", "mbolea", "dawa", "halisi"],
        "en": "Buy seed, fertilizer and pesticide only from dealers marked verified in the app, check the seal and "
              "label, and keep the receipt. Report a suspected fake to the extension officer.",
        "sw": "Nunua mbegu, mbolea na dawa kwa wauzaji waliothibitishwa kwenye programu tu, kagua lakiri na lebo, na "
              "uhifadhi risiti. Ripoti bidhaa unayoshuku ni bandia kwa afisa ugani.",
    },
    {
        "id": "PRICE_CHECK", "crop": None,
        "keywords": ["price", "sell", "selling", "buyer", "middleman", "worth", "market",
                     "bei", "kuuza", "uza", "mnunuzi", "dalali", "soko"],
        "en": "Use the price check: say the buyer's offer and the app compares it with recent market prices. It does "
              "not tell you whether to sell; that decision is yours.",
        "sw": "Tumia ukaguzi wa bei: sema bei ya mnunuzi na programu itailinganisha na bei za karibuni sokoni. "
              "Haikuambii uuze au usiuze; uamuzi ni wako.",
    },
    {
        "id": "PLANTING_TIME", "crop": None,
        "keywords": ["plant", "planting", "when", "sow", "rain", "rains", "season",
                     "kupanda", "panda", "lini", "mvua", "msimu"],
        "en": "Plant once the rains are well established and the soil is moist below the surface. Ask the extension "
              "officer for this season's local calendar; the app can tell you how much rain has fallen so far.",
        "sw": "Panda mvua zikishaanza vizuri na udongo una unyevu chini ya uso. Muulize afisa ugani kalenda ya msimu "
              "huu; programu inaweza kukuambia mvua iliyonyesha hadi sasa.",
    },
    {
        "id": "YELLOW_LEAVES", "crop": None,
        "keywords": ["yellow", "pale", "yellowing", "leaves", "nutrient",
                     "njano", "manjano", "majani", "rangi"],
        "en": "Yellow leaves have many causes: too little nitrogen, too much or too little water, or disease. Take a "
              "photo and ask the extension officer, or ask your cooperative about a soil test, before buying fertilizer.",
        "sw": "Majani ya njano yana sababu nyingi: upungufu wa naitrojeni, maji mengi au machache, au ugonjwa. Piga "
              "picha na umuulize afisa ugani, au uliza chama kuhusu kupima udongo, kabla ya kununua mbolea.",
    },
]

NOT_SURE = {
    "en": "I am not sure about this. I have sent your question to the extension officer, who will reply.",
    "sw": "Sina uhakika na hili. Nimetuma swali lako kwa afisa ugani, atakujibu.",
}
