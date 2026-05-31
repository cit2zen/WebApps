from datetime import datetime, date, time, timedelta
import pytz
from config import BASE_DATE, NUM_SECRETS

KST = pytz.timezone("Asia/Seoul")

def get_slot_for_time(dt: datetime) -> int:
    hour = dt.hour
    if 8 <= hour < 16:
        return 0
    elif 16 <= hour < 24:
        return 1
    else:
        return 2

def get_current_slot() -> int:
    return get_slot_for_time(datetime.now(KST))

def get_puzzle_number_for_time(dt: datetime) -> int:
    slot = get_slot_for_time(dt)
    current_date = dt.date() if slot != 2 else dt.date() - timedelta(days=1)
    days = (current_date - BASE_DATE).days
    return (days * 3 + slot) % NUM_SECRETS

def get_current_puzzle_number() -> int:
    return get_puzzle_number_for_time(datetime.now(KST))

def get_next_change_for_time(dt: datetime) -> datetime:
    slot = get_slot_for_time(dt)
    today = dt.date()
    if slot == 0:
        return KST.localize(datetime.combine(today, time(16, 0)))
    elif slot == 1:
        return KST.localize(datetime.combine(today + timedelta(days=1), time(0, 0)))
    else:
        return KST.localize(datetime.combine(today, time(8, 0)))

def get_next_change_time() -> datetime:
    return get_next_change_for_time(datetime.now(KST))
