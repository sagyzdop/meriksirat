# Parent booking status is derived from its items

A booking's status is never written by the flows that change it. Every item
transition re-derives the parent status from its items' statuses, so the parent is
a pure function of its children and cannot drift. One rule is worth stating
because it is easy to get wrong: a booking whose only non-cancelled items are
returned is `returned`, not `partially_returned`.
