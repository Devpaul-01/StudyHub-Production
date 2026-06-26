from app import create_app
from extensions import db

app, scheduler = create_app()

with app.app_context():
    from models import User, StudentProfile, OnboardingDetails, Connection
    from sqlalchemy import or_

    USER_ID = 1
    print("=" * 60)
    print(f"DIAGNOSING candidates_data for user_id={USER_ID}")
    print("=" * 60)

    # ── Step 1: Basic user counts ────────────────────────────────
    total_users     = User.query.count()
    approved_users  = User.query.filter_by(status="approved").count()
    print(f"\n[1] Total users          : {total_users}")
    print(f"    Approved users        : {approved_users}")

    # ── Step 2: Profile / onboarding coverage ────────────────────
    users_with_profile    = db.session.query(User).join(
        StudentProfile, StudentProfile.user_id == User.id
    ).count()
    users_with_onboarding = db.session.query(User).join(
        OnboardingDetails, OnboardingDetails.user_id == User.id
    ).count()
    users_with_both = db.session.query(User).join(
        StudentProfile, StudentProfile.user_id == User.id
    ).join(
        OnboardingDetails, OnboardingDetails.user_id == User.id
    ).count()

    print(f"\n[2] Users WITH StudentProfile    : {users_with_profile}")
    print(f"    Users WITH OnboardingDetails  : {users_with_onboarding}")
    print(f"    Users WITH BOTH               : {users_with_both}")

    if users_with_both == 0:
        print("\n  ❌ PROBLEM: No users have both a StudentProfile AND OnboardingDetails.")
        print("     The 3-way join will always return 0 rows.")
        print("     → Did user_seed.py commit successfully?")
        print("     → Check for any rollback errors in seed logs.")

    # ── Step 3: Excluded IDs (same logic as endpoint) ────────────
    existing_connections = Connection.query.filter(
        or_(
            Connection.requester_id == USER_ID,
            Connection.receiver_id  == USER_ID,
        )
    ).all()

    excluded_ids = {USER_ID}
    for conn in existing_connections:
        other = conn.receiver_id if conn.requester_id == USER_ID else conn.requester_id
        excluded_ids.add(other)

    print(f"\n[3] Connections involving user {USER_ID} : {len(existing_connections)}")
    print(f"    Excluded IDs count (incl. self)      : {len(excluded_ids)}")

    # ── Step 4: Approved users NOT in excluded set ───────────────
    non_excluded_approved = User.query.filter(
        User.id.notin_(excluded_ids),
        User.status == "approved",
    ).count()
    print(f"\n[4] Approved users outside excluded_ids : {non_excluded_approved}")

    if non_excluded_approved == 0:
        print("  ❌ PROBLEM: Every approved user is already in excluded_ids.")
        print("     → connection_seed.py connected user 1 to ALL other users.")

    # ── Step 5: Replicate the 3-way join with exclusions ─────────
    candidates_data = (
        db.session.query(User, StudentProfile, OnboardingDetails)
        .join(StudentProfile,    StudentProfile.user_id    == User.id)
        .join(OnboardingDetails, OnboardingDetails.user_id == User.id)
        .filter(
            User.id.notin_(excluded_ids),
            User.status == "approved",
        )
        .limit(100)
        .all()
    )
    print(f"\n[5] candidates_data (full query) count  : {len(candidates_data)}")

    if len(candidates_data) == 0:
        print("  ❌ This is why the endpoint returns no data.\n")

        # Narrow down the cause
        # 5a: Without the exclusion filter
        without_exclusion = (
            db.session.query(User, StudentProfile, OnboardingDetails)
            .join(StudentProfile,    StudentProfile.user_id    == User.id)
            .join(OnboardingDetails, OnboardingDetails.user_id == User.id)
            .filter(User.status == "approved")
            .count()
        )
        print(f"  [5a] Same join WITHOUT exclusion filter : {without_exclusion}")

        if without_exclusion == 0:
            print("       → Root cause: missing StudentProfile or OnboardingDetails rows.")
        else:
            print(f"       → {without_exclusion} rows exist but all excluded by connections.")
            print("         Root cause: connection_seed.py over-connected user 1.")

    # ── Step 6: Sample a few non-excluded users to inspect ───────
    sample_users = User.query.filter(
        User.id.notin_(excluded_ids),
        User.status == "approved",
    ).limit(5).all()

    print(f"\n[6] Sample non-excluded approved users (up to 5):")
    if not sample_users:
        print("    (none found)")
    else:
        for u in sample_users:
            prof = StudentProfile.query.filter_by(user_id=u.id).first()
            onb  = OnboardingDetails.query.filter_by(user_id=u.id).first()
            print(f"    user_id={u.id:3d}  profile={'✅' if prof else '❌'}  "
                  f"onboarding={'✅' if onb else '❌'}  status={u.status!r}")

    # ── Step 7: User 1 own profile check ─────────────────────────
    u1_profile    = StudentProfile.query.filter_by(user_id=USER_ID).first()
    u1_onboarding = OnboardingDetails.query.filter_by(user_id=USER_ID).first()
    print(f"\n[7] User 1 StudentProfile    : {'✅ exists' if u1_profile else '❌ MISSING'}")
    print(f"    User 1 OnboardingDetails : {'✅ exists' if u1_onboarding else '❌ MISSING'}")
    if u1_profile:
        print(f"    department={u1_profile.department!r}  class={u1_profile.class_name!r}")
    if u1_onboarding:
        print(f"    subjects={u1_onboarding.subjects}")

    print("\n" + "=" * 60)
    print("DIAGNOSIS COMPLETE")
    print("=" * 60)