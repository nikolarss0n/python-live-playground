"""Route the refresher's executable contracts, including personal consolidation."""

from refresher_foundation_checks import check_refresher_foundations
from refresher_advanced_checks import check_refresher_advanced


async def check_refresher(namespace, exercise_id, context=None):
    context = context or {}
    if exercise_id == "refresher-14":
        selected = context.get("revisit", [])
        allowed = {f"refresher-{number:02}" for number in range(1, 12)}
        if len(selected) != 2 or len(set(selected)) != 2 or not all(day in allowed for day in selected):
            return []
        results = []
        for day in selected:
            for check in await check_refresher(namespace, day, {"consolidation": True}):
                results.append({**check, "id": day + ":" + check["id"]})
        return results
    results = await check_refresher_foundations(namespace, exercise_id, context)
    if results:
        return results
    return await check_refresher_advanced(namespace, exercise_id, context)
