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
from app.models.work_order import WorkOrderRepair, Task, WorkOrderNote
from app.models.part import Part
from app.models.lookup import IndirectActivity, WorkOrderStatus, RepairReason, PartRequestStatus


def seed_database(db):
    # ── Lookup tables ───────────────────────────────────────────────────────
    db.add_all([
        WorkOrderStatus(code="A", description="Active"),
        WorkOrderStatus(code="C", description="Completed"),
        WorkOrderStatus(code="H", description="On Hold"),
        WorkOrderStatus(code="W", description="Waiting Parts"),
        WorkOrderStatus(code="R", description="Return to Shop"),
    ])

    db.add_all([
        RepairReason(description="Customer Complaint"),
        RepairReason(description="Preventive Maintenance"),
        RepairReason(description="Accident Damage"),
        RepairReason(description="Warranty Claim"),
        RepairReason(description="Recall"),
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
            subject="Customer request",
            note="Customer requested all-season tires if any need replacement.",
            is_document=False,
            is_pending=False,
            created_user_id=1,
            created_technician_id=demo_tech.id,
        ),
        WorkOrderNote(
            repair_id=repairs[0].id,
            subject="Tow-in note",
            note="Vehicle towed in — check for suspension damage from kerb impact.",
            is_document=False,
            is_pending=True,
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

    db.commit()
    print(f"Seeded: 5 shops, {len(technicians)} technicians, 10 work orders, tasks, notes, parts.")
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
