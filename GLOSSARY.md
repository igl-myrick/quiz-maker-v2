# Quiz Maker

A casual quiz platform where anyone can take public trivia and personality quizzes, and members can save results and create quizzes.

## People

**Anonymous visitor**:
Someone using the site without logging in.
_Avoid_: Guest, user

**Member**:
Someone logged in with an email one-time code.
_Avoid_: User, account holder

**Creator**:
The member who made a particular quiz. A relationship to a quiz, not a separate kind of person.

## Quizzes

**Quiz**:
A public set of questions of one fixed kind, trivia or personality. A creator may call it a "test" in its title, but there is no separate test concept.
_Avoid_: Test (as a concept)

**Quiz kind**:
Whether a quiz is trivia (scored right or wrong) or personality (leads to an outcome). Fixed when the quiz is created.

**Question**:
One item in a quiz, answered only by choosing options: single-choice, true/false, or multi-select.

**Option**:
One answer choice within a question.
_Avoid_: Answer (for the choice itself)

**Outcome**:
One of the possible personalities a personality quiz can lead to.
_Avoid_: Result (for this meaning), personality type

**Answer key**:
The private part of a quiz: which options are correct, or which outcome each option points to and for how many points.

**Quiz version**:
A number that goes up every time a quiz is edited.

**Retired version**:
A private, sealed copy of a quiz version that was replaced by an edit or removed by deletion, kept for one day so that takes started on it can still be graded.
_Avoid_: Old version, archive, history

**Suggested time**:
An optional, advisory amount of time a creator recommends for a quiz. Takers choose before starting whether to use the timer, and it is never enforced.
_Avoid_: Time limit, deadline

## Taking quizzes

**Take**:
One person's in-progress, unsubmitted work through a quiz in their browser.
_Avoid_: Attempt, session

**Submission**:
A finished take sent to be graded.
_Avoid_: Attempt

**Result**:
The saved, graded record of one submission, viewable at its own link. Applies to both quiz kinds.
_Avoid_: Attempt, score (for the whole record)

**Winning outcome**:
The one outcome a personality result shows, chosen by most points with ties broken randomly once at submission.

**Snapshot**:
The copy of the quiz as it was when taken, stored inside a result so the result never changes when the quiz does.

## Ownership

**Claim token**:
A secret given once to the browser that submitted an anonymous result, proving that browser may claim it.

**Claim**:
A member explicitly saving an unexpired anonymous result to their account.
_Avoid_: Adopt, link, import
