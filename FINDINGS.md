# Findings

Real issues found and diagnosed while reviewing this codebase, logged as part of ongoing code review practice.

## Wrong date extracted from payslip text

*Off-by-one / pattern matching too loosely*

**Diagnosis:** self.get_pay_date returns the first date it comes to in sample_text, which is the date of birth, not the actual pay date. The regex just matches any date-shaped text without knowing which label it belongs to.

**Fix:** Refine the pattern to search specifically near the words "Pay Date" and ignore other dates in the text, rather than grabbing the first date-shaped match anywhere in the document.

## Eval score silently understates what was actually tested

*Wrong denominator / data mismatch*

**Diagnosis:** predictions has 2 items and golden_set has 3. zip() stops at the shorter list, so we only iterate twice — there's nothing at position 2 in predictions to pair with "eggs" in golden_set, so it's silently skipped and never compared. This skews the data, because the score is still divided by len(golden_set), which is 3, even though only 2 items were actually tested.

**Fix:** Check that predictions and golden_set are the same length before running the eval, and raise or flag a warning if they're not — don't let a length mismatch silently pass through zip().
