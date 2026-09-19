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

## Bare except hides API failure

*Silent failure / bare except*

**Diagnosis:** There was no raise statement to alert us if the lookup function returns None, which would then crash when we tried to read it in the total_calories function.

**Fix:** Add a raise statement inside the except block, so a failed lookup fails loudly and immediately instead of quietly returning None and crashing two calls later, far from the real cause.

## Retriever returns the worst matches instead of the best

*Sort or ordering bug*

**Diagnosis:** .sort() natively returns in the opposite order to what we want. It sorts ascending by default, so taking the first items after sorting gives the lowest-scoring (worst) matches, not the highest-scoring (best) ones.

**Fix:** Invert the results so we return the best match — use scores.sort(reverse=True), or sorted(scores, reverse=True), so the highest similarity scores come first.

## Silent fallback API key disguises broken auth as working

*Hardcoded secret*

**Diagnosis:** If the real GROQ_API_KEY environment variable is missing, the code doesn't fail or warn — it silently swaps in a fake fallback key and carries on as if everything's fine. Nothing breaks at this point; settings.api_key prints normally. The failure only shows up much later, when an actual API call goes out with the fake key and fails, far from where the real problem started.

**Fix:** Raise an error immediately if the real API key isn't set, instead of silently falling back to a placeholder — fail loudly at startup rather than confusingly at request time.
