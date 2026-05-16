"""
Run once to initialise the database with realistic demo data.
Usage: source .venv/bin/activate && python -m app.seed
"""
from datetime import datetime, timedelta, timezone

from app.database import engine, SessionLocal, Base
import app.models  # noqa: F401 — registers all ORM classes with Base

from app.models.shop import Shop
from app.models.technician import Technician
from app.models.shift import Shift
from app.models.asset import Asset
from app.models.work_order import WorkOrder, WorkOrderRepair, Task, WorkOrderNote
from app.models.part import Part, PartCatalog
from app.models.lookup import IndirectActivity, WorkOrderStatus, RepairReason, PartRequestStatus


def seed_database(db):
    # ── Lookup tables ───────────────────────────────────────────────────────
    db.add_all([
        WorkOrderStatus(code="A", description="Active - Repair in Progress"),
        WorkOrderStatus(code="Q", description="Awaiting Dept Repair Authorization"),
        WorkOrderStatus(code="W", description="Awaiting Technician Asset In-Service"),
        WorkOrderStatus(code="M", description="Awaiting Technician Asset Out of Service"),
        WorkOrderStatus(code="E", description="Estimate"),
        WorkOrderStatus(code="F", description="Finished - Ready for Pickup"),
        WorkOrderStatus(code="O", description="Parts On Order - Asset In Service"),
        WorkOrderStatus(code="P", description="Parts On Ordered - Asset Out of Service"),
        WorkOrderStatus(code="I", description="Pending Vendor Invoice"),
        WorkOrderStatus(code="N", description="Ready for Part Review"),
        WorkOrderStatus(code="R", description="Road Call - Dispatched"),
        WorkOrderStatus(code="V", description="Vendor Repair"),
        WorkOrderStatus(code="D", description="WAITING FUNDS"),
    ])

    db.add_all([
        RepairReason(description="Accident"),
        RepairReason(description="Accident, Non-Reported"),
        RepairReason(description="Additional PM-Tasks"),
        RepairReason(description="Alert"),
        RepairReason(description="Body Work"),
        RepairReason(description="Brake Service"),
        RepairReason(description="BreakDown"),
        RepairReason(description="Electrical Issue"),
        RepairReason(description="Engine Repair"),
        RepairReason(description="General Repair"),
        RepairReason(description="General Repair - Driver Report"),
        RepairReason(description="Inspection"),
        RepairReason(description="Maintenance"),
        RepairReason(description="Management Request"),
        RepairReason(description="Manufacture Recall/Campaign"),
        RepairReason(description="Natural Disaster"),
        RepairReason(description="Operator Responsible"),
        RepairReason(description="Other"),
        RepairReason(description="Routine Maintenance"),
        RepairReason(description="Statutory Inspection"),
        RepairReason(description="Tire Replacement"),
        RepairReason(description="Transmission Repair"),
        RepairReason(description="Vandalism"),
        RepairReason(description="Vendor Repair"),
        RepairReason(description="Warranty"),
    ])

    db.add_all([
        PartRequestStatus(name="Requested"),
        PartRequestStatus(name="Issued"),
        PartRequestStatus(name="Cancelled"),
        PartRequestStatus(name="Delayed"),
    ])

    db.add_all([
        IndirectActivity(name="Chain Tire Dismount / Mount",           category="Tire",         repair_group_component_action_id=39182),
        IndirectActivity(name="Shop Admin D & A Testing",              category="Shop Admin",   repair_group_component_action_id=39100),
        IndirectActivity(name="Shop Admin Meetings",                   category="Shop Admin",   repair_group_component_action_id=39101),
        IndirectActivity(name="Shop Admin Clerical",                   category="Shop Admin",   repair_group_component_action_id=39102),
        IndirectActivity(name="Shop Admin Blood Drive",                category="Shop Admin",   repair_group_component_action_id=39103),
        IndirectActivity(name="Shop Admin Fleet Equipment Setup",      category="Shop Admin",   repair_group_component_action_id=39104),
        IndirectActivity(name="Shop Admin Doctor Workers Comp",        category="Shop Admin",   repair_group_component_action_id=39187),
        IndirectActivity(name="Shop Admin ASE Testing",                category="Shop Admin",   repair_group_component_action_id=39186),
        IndirectActivity(name="Break -Break",                          category="Break",        repair_group_component_action_id=39105),
        IndirectActivity(name="Break -Lunch",                          category="Break",        repair_group_component_action_id=39106),
        IndirectActivity(name="Fuel System Support Diagnosis",         category="Fuel",         repair_group_component_action_id=39107),
        IndirectActivity(name="Fuel System Support Repair",            category="Fuel",         repair_group_component_action_id=39108),
        IndirectActivity(name="Fuel System Support Nozzle",            category="Fuel",         repair_group_component_action_id=39109),
        IndirectActivity(name="Fuel System Support Hose",              category="Fuel",         repair_group_component_action_id=39110),
        IndirectActivity(name="Union Business Meetings",               category="Union",        repair_group_component_action_id=39111),
        IndirectActivity(name="Training Time Training",                category="Training",     repair_group_component_action_id=39112),
        IndirectActivity(name="Training Time CDL",                     category="Training",     repair_group_component_action_id=39113),
        IndirectActivity(name="Training Time Video- In house",         category="Training",     repair_group_component_action_id=39114),
        IndirectActivity(name="Wait Time For OK To Begin Job",         category="Wait Time",    repair_group_component_action_id=39115),
        IndirectActivity(name="Wait Time For Job Assignment",          category="Wait Time",    repair_group_component_action_id=39116),
        IndirectActivity(name="Wait Time For Repair Space",            category="Wait Time",    repair_group_component_action_id=39117),
        IndirectActivity(name="Shop Operations Diagnosis",             category="Shop Ops",     repair_group_component_action_id=39118),
        IndirectActivity(name="Shop Operations Mowing",                category="Shop Ops",     repair_group_component_action_id=39119),
        IndirectActivity(name="Shop Operations Move / Transport",      category="Shop Ops",     repair_group_component_action_id=39120),
        IndirectActivity(name="Shop Operations Pick Up Unit",          category="Shop Ops",     repair_group_component_action_id=39121),
        IndirectActivity(name="Shop Operations Deliver Unit",          category="Shop Ops",     repair_group_component_action_id=39122),
        IndirectActivity(name="Shop Operations WorkStation Clean Up",  category="Shop Ops",     repair_group_component_action_id=39123),
        IndirectActivity(name="Shop Operations Janitorial",            category="Shop Ops",     repair_group_component_action_id=39124),
        IndirectActivity(name="Shop Operations Vehicle Cleaning",      category="Shop Ops",     repair_group_component_action_id=39125),
        IndirectActivity(name="Shop Operations Steam Clean",           category="Shop Ops",     repair_group_component_action_id=39126),
        IndirectActivity(name="Shop Operations Used Part Remove",      category="Shop Ops",     repair_group_component_action_id=39127),
        IndirectActivity(name="Shop Operations Fueling Operation",     category="Shop Ops",     repair_group_component_action_id=39128),
        IndirectActivity(name="Shop Operations Fuel Pump Reading",     category="Shop Ops",     repair_group_component_action_id=39129),
        IndirectActivity(name="Shop Operations Re-Stocking Oil",       category="Shop Ops",     repair_group_component_action_id=39130),
        IndirectActivity(name="Shop Operations Snow Removal",          category="Shop Ops",     repair_group_component_action_id=39131),
        IndirectActivity(name="Shop Operations Shop Equipment Repair", category="Shop Ops",     repair_group_component_action_id=39132),
        IndirectActivity(name="Shop Operations Receiving Tires",       category="Shop Ops",     repair_group_component_action_id=39133),
        IndirectActivity(name="Shop Operations Tire Inventory",        category="Shop Ops",     repair_group_component_action_id=39134),
        IndirectActivity(name="Shop Operations Finding Unit",          category="Shop Ops",     repair_group_component_action_id=39135),
        IndirectActivity(name="Shop Operations Parts Run",             category="Shop Ops",     repair_group_component_action_id=39136),
        IndirectActivity(name="Shop Operations Pop Machine",           category="Shop Ops",     repair_group_component_action_id=39137),
        IndirectActivity(name="TIRE M/D Stock",                        category="Tire",         repair_group_component_action_id=39138),
        IndirectActivity(name="TIRE Move / Transport",                 category="Tire",         repair_group_component_action_id=39176),
        IndirectActivity(name="Leave Time Annual",                     category="Leave",        repair_group_component_action_id=39224),
        IndirectActivity(name="Leave Time Sick",                       category="Leave",        repair_group_component_action_id=39225),
        IndirectActivity(name="Leave Time Workers Comp",               category="Leave",        repair_group_component_action_id=39226),
    ])

    db.flush()

    # ── Shops ────────────────────────────────────────────────────────────────
    shops = [
        Shop(name="Downtown Auto Center"),
        Shop(name="Westside Fleet Services"),
        Shop(name="Express Lube #1"),
        Shop(name="Northgate Heavy Repair"),
        Shop(name="Metro Fleet Solutions"),
    ]
    db.add_all(shops)
    db.flush()

    # ── Technicians (25 total, 5 per shop) ──────────────────────────────────
    names_roles = [
        ("Marcus Allen", "Lead Technician"),
        ("Diana Torres", "Senior Technician"),
        ("Kevin Park", "Technician"),
        ("Sandra Mitchell", "Technician"),
        ("James Okafor", "Apprentice"),
        ("Rachel Nguyen", "Lead Technician"),
        ("Tyler Brooks", "Senior Technician"),
        ("Maria Flores", "Technician"),
        ("Andre Johnson", "Technician"),
        ("Lisa Chen", "Apprentice"),
        ("Bryan Cooper", "Lead Technician"),
        ("Stephanie Reed", "Senior Technician"),
        ("Darnell Washington", "Technician"),
        ("Ashley Kim", "Technician"),
        ("Robert Patel", "Apprentice"),
        ("Jennifer Garcia", "Lead Technician"),
        ("Marcus Thompson", "Senior Technician"),
        ("Carmen Rivera", "Technician"),
        ("Derek Williams", "Technician"),
        ("Nicole Davis", "Apprentice"),
        ("Patrick O'Brien", "Lead Technician"),
        ("Aisha Jackson", "Senior Technician"),
        ("Eric Hernandez", "Technician"),
        ("Brittany Moore", "Technician"),
        ("Samuel Lee", "Apprentice"),
    ]

    technicians = []
    for i, (name, role) in enumerate(names_roles):
        shop = shops[i // 5]
        t = Technician(
            name=name,
            role=role,
            shop_id=shop.id,
            email=name.lower().replace(" ", ".").replace("'", "") + "@autotech.com",
            pin="1234",
        )
        db.add(t)
        technicians.append(t)
    db.flush()

    # Technician at index 9 will have ID ~10 depending on DB sequence.
    # We use technicians[9] (Lisa Chen) as the demo "technician 10".
    demo_tech = technicians[9]

    # ── Active shift for demo technician ────────────────────────────────────
    shift_start = datetime.now(timezone.utc) - timedelta(hours=2, minutes=15)
    active_shift = Shift(
        technician_id=demo_tech.id,
        shop_id=demo_tech.shop_id,
        begin_time=shift_start,
        created_user_id=1,
        status_indicator=None,
    )
    db.add(active_shift)
    db.flush()

    # Past closed shift for completed repairs count demo
    past_shift = Shift(
        technician_id=demo_tech.id,
        shop_id=demo_tech.shop_id,
        begin_time=datetime.now(timezone.utc) - timedelta(days=1, hours=8),
        end_time=datetime.now(timezone.utc) - timedelta(days=1),
        created_user_id=1,
    )
    db.add(past_shift)
    db.flush()

    # ── Work order repairs for demo technician ───────────────────────────────
    vehicles = [
        (2021, "Ford", "F-150", "1FTFW1EG0MFA12345", "TIR-001"),
        (2019, "Chevrolet", "Silverado 1500", "3GCUKREC5EG123456", "BRK-002"),
        (2020, "Toyota", "Camry", "4T1BF1FK0EU123456", "OIL-001"),
        (2018, "Honda", "Accord", "1HGCR2F87EA123456", "TRN-003"),
        (2022, "Dodge", "Ram 1500", "1C6RR7LT0ES123456", "ENG-005"),
        (2017, "Ford", "Explorer", "1FM5K8GT0EGA12345", "EXH-002"),
        (2023, "GMC", "Sierra 1500", "1GTV2MEC5EZ123456", "SUS-001"),
        (2016, "Nissan", "Frontier", "1N6AD0ER5CC123456", "CLU-001"),
        (2020, "Jeep", "Wrangler", "1C4HJWDG0GL123456", "TIR-002"),
        (2019, "Ram", "ProMaster", "3C6TRVBG0EE123456", "HTR-001"),
    ]

    repair_titles = [
        "Tire Rotation and Balance",
        "Brake Pad Replacement – Front",
        "Oil Change and Filter",
        "Transmission Service",
        "Engine Diagnostic and Tune-Up",
        "Exhaust System Repair",
        "Suspension Inspection",
        "Clutch Replacement",
        "Tire Swap – Winter Set",
        "Heater Core Replacement",
    ]

    priorities = ["LOW", "MEDIUM", "HIGH", "LOW", "HIGH", "MEDIUM", "LOW", "MEDIUM", "LOW", "HIGH"]
    parts_statuses = [
        "PARTS UNASSIGNED", "PARTS REQUESTED", "PARTS ISSUED",
        "PARTS UNASSIGNED", "PARTS REQUESTED", "PARTS ISSUED",
        "PARTS UNASSIGNED", "PARTS REQUESTED", "PARTS UNASSIGNED", "PARTS REQUESTED",
    ]
    wo_statuses = ["A", "A", "A", "H", "A", "C", "A", "W", "A", "A"]

    repairs = []
    for idx, (year, make, model, vin, rcode) in enumerate(vehicles):
        date_in = datetime.now(timezone.utc) - timedelta(days=idx, hours=3)
        shift_id = active_shift.id if idx < 7 else past_shift.id
        is_open = wo_statuses[idx] != "C"
        r = WorkOrderRepair(
            wo_number=f"WO-2024-{1000 + idx:04d}",
            wo_status_code=wo_statuses[idx],
            title=repair_titles[idx],
            asset_year=year,
            asset_make=make,
            asset_model=model,
            vin=vin,
            repair_code=rcode,
            shop_id=demo_tech.shop_id,
            time_standard=round(0.5 + idx * 0.3, 1),
            date_in=date_in,
            priority=priorities[idx],
            parts_status=parts_statuses[idx],
            technician_id=demo_tech.id,
            shift_id=shift_id,
            is_open=is_open,
        )
        db.add(r)
        repairs.append(r)
    db.flush()

    # ── Link first repair to a work order document ──────────────────────────
    demo_wo = WorkOrder(
        wo_number=repairs[0].wo_number,
        asset_number=repairs[0].vin,
        asset_year=repairs[0].asset_year,
        asset_make=repairs[0].asset_make,
        asset_model=repairs[0].asset_model,
        shop_id=demo_tech.shop_id,
        org_id=demo_tech.shop_id,
        status_code=repairs[0].wo_status_code,
        priority=repairs[0].priority,
    )
    db.add(demo_wo)
    db.flush()
    repairs[0].work_order_id = demo_wo.id
    db.flush()

    # ── Work order repairs for Tyler Brooks ─────────────────────────────────
    tyler = technicians[6]  # Tyler Brooks, Westside Fleet Services
    tyler_shift = Shift(
        technician_id=tyler.id,
        shop_id=tyler.shop_id,
        begin_time=datetime.now(timezone.utc) - timedelta(hours=3, minutes=45),
        created_user_id=1,
        status_indicator=None,
    )
    db.add(tyler_shift)
    db.flush()

    tyler_vehicles = [
        (2020, "Ford", "Transit 250", "1FTBR1C80LKA11111", "ENG-001"),
        (2022, "Chevrolet", "Express 2500", "1GCWGAFG0N1222222", "BRK-001"),
        (2019, "Ford", "F-250", "1FT7W2BT0KEA33333", "OIL-002"),
        (2021, "Ram", "1500 Classic", "1C6RR6FT8MS444444", "SUS-002"),
        (2018, "GMC", "Yukon XL", "1GKS2HKJ9JR555555", "ELC-001"),
        (2023, "Toyota", "Tundra", "5TFDY5F12NX666666", "TIR-003"),
    ]
    tyler_titles = [
        "Engine Oil Leak Diagnosis",
        "Rear Brake Drum Replacement",
        "Full Synthetic Oil Service",
        "Front Suspension Alignment",
        "Electrical System Diagnosis",
        "Tire Rotation – Full Set",
    ]
    tyler_priorities    = ["HIGH", "MEDIUM", "LOW", "MEDIUM", "HIGH", "LOW"]
    tyler_parts_statuses = ["PARTS REQUESTED", "PARTS UNASSIGNED", "PARTS ISSUED", "PARTS UNASSIGNED", "PARTS UNASSIGNED", "PARTS UNASSIGNED"]
    tyler_wo_statuses   = ["A", "A", "A", "A", "H", "A"]

    tyler_repairs = []
    for idx, (year, make, model, vin, rcode) in enumerate(tyler_vehicles):
        date_in = datetime.now(timezone.utc) - timedelta(days=idx, hours=1)
        r = WorkOrderRepair(
            wo_number=f"WO-2024-{2000 + idx:04d}",
            wo_status_code=tyler_wo_statuses[idx],
            title=tyler_titles[idx],
            asset_year=year,
            asset_make=make,
            asset_model=model,
            vin=vin,
            repair_code=rcode,
            shop_id=tyler.shop_id,
            time_standard=round(0.5 + idx * 0.4, 1),
            date_in=date_in,
            priority=tyler_priorities[idx],
            parts_status=tyler_parts_statuses[idx],
            technician_id=tyler.id,
            shift_id=tyler_shift.id,
            is_open=tyler_wo_statuses[idx] != "C",
        )
        db.add(r)
        tyler_repairs.append(r)
    db.flush()

    # ── Tasks for first two repairs ─────────────────────────────────────────
    task_templates = [
        [
            ("Inspect tire tread depth and sidewall condition", 1, "Measure tread depth at 3 points per tire; check for cracking or bulging on sidewalls.", True),
            ("Check wheel balance using balancer machine", 2, "Mount each wheel on balancer and add weights as needed to within 0.25 oz.", True),
            ("Rotate tires per manufacturer specification", 3, "Follow cross-rotation pattern per OEM spec in service manual.", True),
            ("Torque lug nuts to spec", 4, "Torque to 100 ft-lb in star pattern; verify with torque stick.", True),
        ],
        [
            ("Inspect brake pad thickness", 1, "Measure pad thickness; replace if below 3mm.", True),
            ("Check rotor for scoring or warping", 2, "Measure rotor thickness and run-out; replace if beyond discard spec.", True),
            ("Remove caliper and replace brake pads", 3, "Compress piston, install new pads, lubricate slide pins.", True),
            ("Bed-in brake pads with moderate stops", 4, "Perform 10 moderate stops from 35 mph per manufacturer break-in procedure.", True),
        ],
    ]
    for r_idx, task_list in enumerate(task_templates):
        for task_name, step, instruction, has_instruction in task_list:
            db.add(Task(
                repair_id=repairs[r_idx].id,
                step_number=step,
                task_name=task_name,
                result_id=None,
                result_name=None,
                comment=None,
                instruction=instruction,
                has_instruction=has_instruction,
            ))

    # ── Notes for first repair ───────────────────────────────────────────────
    db.add_all([
        WorkOrderNote(
            repair_id=repairs[0].id,
            document_id=None,
            subject="Customer request",
            note="Customer requested all-season tires if any need replacement.",
            is_work_order=False,
            user_name=demo_tech.name.split()[0] + "." + demo_tech.name.split()[-1][0] if len(demo_tech.name.split()) >= 2 else demo_tech.name,
            created_user_id=1,
            created_technician_id=demo_tech.id,
        ),
        WorkOrderNote(
            repair_id=None,
            document_id=repairs[0].work_order_id,
            subject="Tow-in note",
            note="Vehicle towed in — check for suspension damage from kerb impact.",
            is_work_order=True,
            user_name=demo_tech.name.split()[0] + "." + demo_tech.name.split()[-1][0] if len(demo_tech.name.split()) >= 2 else demo_tech.name,
            created_user_id=1,
            created_technician_id=demo_tech.id,
        ),
    ])

    # ── Parts for first three repairs ───────────────────────────────────────
    part_data = [
        (repairs[0].id, repairs[0].wo_number, repairs[0].repair_code, 101, "All-Season Tire 265/70R17", 1, 2),
        (repairs[1].id, repairs[1].wo_number, repairs[1].repair_code, 202, "Front Brake Pad Set", 1, 2),
        (repairs[1].id, repairs[1].wo_number, repairs[1].repair_code, 203, "Brake Rotor – Driver Side", 2, 0),
        (repairs[2].id, repairs[2].wo_number, repairs[2].repair_code, 301, "Engine Oil Filter", 2, 1),
        (repairs[2].id, repairs[2].wo_number, repairs[2].repair_code, 302, "5W-30 Synthetic Oil (5qt)", 2, 1),
        (repairs[4].id, repairs[4].wo_number, repairs[4].repair_code, 401, "Spark Plug Set (8pk)", 4, 0),
    ]
    for repair_id, wo_num, rcode, part_id, part_name, status_id, issued_qty in part_data:
        db.add(Part(
            repair_id=repair_id,
            wo_number=wo_num,
            repair_code=rcode,
            part_id=part_id,
            part_name=part_name,
            request_part_status_id=status_id,
            requested_qty=1,
            issued_qty=issued_qty,
            technician_id=demo_tech.id,
            is_own_request=True,
        ))

    # ── Parts catalog ────────────────────────────────────────────────────────────
    catalog_items = [
        ("AF-4425",   "Brake Oil",                        "DOT 3/4 brake fluid, 1 litre",                    24),
        ("AF-4426",   "Brake Fluid",                      "DOT 5.1 synthetic brake fluid, 500ml",            18),
        ("HP-8845-A", "Hydraulic Pump Assembly",          "Heavy-duty replacement pump assembly",             6),
        ("HS-2234",   "Hydraulic Seal Kit",               "Complete seal kit for hydraulic systems",          4),
        ("HO-5512",   "Hydraulic Oil 5L",                 "ISO 46 hydraulic oil, 5 litre",                   12),
        ("OIL-5W30",  "5W-30 Synthetic Oil (5qt)",        "Full synthetic motor oil, 5 quart",               30),
        ("OIL-5W20",  "5W-20 Synthetic Oil (5qt)",        "Full synthetic motor oil, 5 quart",               28),
        ("FLT-OIL",   "Engine Oil Filter",                "Standard engine oil filter",                       50),
        ("FLT-AIR",   "Engine Air Filter",                "Flat-panel air filter",                            22),
        ("FLT-FUEL",  "Fuel Filter",                      "In-line fuel filter",                              15),
        ("BP-F-STD",  "Front Brake Pad Set",              "Semi-metallic front brake pads",                   10),
        ("BP-R-STD",  "Rear Brake Pad Set",               "Semi-metallic rear brake pads",                    8),
        ("RTR-DR",    "Brake Rotor – Driver Side",        "Vented rotor, driver side",                        5),
        ("RTR-PS",    "Brake Rotor – Passenger Side",     "Vented rotor, passenger side",                     5),
        ("SPK-8PK",   "Spark Plug Set (8pk)",             "Iridium spark plugs, pack of 8",                   9),
        ("SPK-4PK",   "Spark Plug Set (4pk)",             "Iridium spark plugs, pack of 4",                   14),
        ("TIR-AS",    "All-Season Tire 265/70R17",        "Highway all-season tire, load rating E",           8),
        ("TIR-WN",    "Winter Tire 265/70R17",            "Studded winter tire, load rating E",               6),
        ("TBT-CLT",   "Clutch Kit – Standard",            "Clutch disc, pressure plate, release bearing",     3),
        ("HTR-CORE",  "Heater Core",                      "Aluminum heater core replacement",                 2),
        ("SUS-STRUT", "Front Strut Assembly",             "Complete front strut assembly with spring",        4),
        ("SUS-CNTRL", "Control Arm – Front Lower",        "Front lower control arm with bushings",            6),
        ("TRN-FLUID", "Transmission Fluid (1 gal)",       "ATF+4 automatic transmission fluid",              20),
        ("TRN-FILT",  "Transmission Filter Kit",          "Pan gasket and filter kit",                        7),
        ("EXH-MNFLD", "Exhaust Manifold Gasket",          "OEM-spec exhaust manifold gasket set",            11),
        ("EXH-MFLR",  "Muffler – Universal",              "Aluminized steel muffler",                         3),
        ("BELT-SERP", "Serpentine Belt",                   "EPDM ribbed serpentine belt",                     16),
        ("BELT-TIM",  "Timing Belt Kit",                   "Timing belt with water pump and tensioner",        4),
        ("COOL-RAD",  "Radiator",                          "Aluminium-core direct-fit radiator",               2),
        ("COOL-THRM", "Thermostat + Housing",              "OEM-spec thermostat kit",                          9),
    ]
    db.add_all([
        PartCatalog(part_number=pn, name=nm, description=desc, available_qty=qty)
        for pn, nm, desc, qty in catalog_items
    ])

    # ── Assets ────────────────────────────────────────────────────────────────
    asset_data = [
        ("1234", shops[0], 2019, "Honda", "Civic Hybrid", "+1-555-333-8567", "SEDAN1", "Replacement Upcoming [U]", 14.8, "04/11/2029", 15, 12345.0),
        ("2698", shops[0], 2019, "Honda", "Civic Hybrid", "1HGFE2F59KA004829", "SEDAN2", "Active Fleet [001]",      14.8, "04/11/2029", 15, 9823.0),
        ("FL-A-042", shops[1], 2021, "Ford",  "F-150",        "1FTFW1EG0MFA12345", "TRUCK1", "Active",                   22.1, "06/15/2030", 20, 31200.0),
        ("VH-2024", shops[2], 2022, "Toyota", "Camry",         "4T1BF1FK0EU777777", "CAM22",  "Active",                    8.5, "09/01/2028", 12, 4500.0),
        ("MWO-099", shops[3], 2018, "Dodge",  "Ram 1500",      "1C6RR7LT0ES654321", "RAM1",   "Active",                   19.3, "01/20/2027", 18, 55600.0),
    ]
    for an, shop, yr, mk, mdl, vin, lic, status, tpv, ord_, psu, meter in asset_data:
        db.add(Asset(
            asset_number=an,
            org_id=shop.id,
            year=yr,
            make=mk,
            model=mdl,
            vin=vin,
            license=lic,
            status=status,
            total_point_value=tpv,
            original_replacement_date=ord_,
            point_scale_used=psu,
            meter_reading=meter,
        ))

    db.commit()
    print(f"Seeded: 5 shops, {len(technicians)} technicians, 10 work orders, tasks, notes, parts, {len(catalog_items)} catalog items, {len(asset_data)} assets.")
    print(f"Demo technician ID: {demo_tech.id} — PIN: 1234")


if __name__ == "__main__":
    print("Dropping and recreating all tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()

    print("Done. Start the server with: uvicorn app.main:app --reload")
