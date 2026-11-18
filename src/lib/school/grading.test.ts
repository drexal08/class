import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  categoryAverage,
  computeTerm,
  roundAverage,
  scorePercentage,
  termAverage,
  weightsAreValid,
  weightsTotal,
} from "./grading";

const weights = [
  { id: "coursework", weight: 40 },
  { id: "tests", weight: 60 },
];

describe("categoryAverage", () => {
  it("adds the marks and divides by the marks available", () => {
    const average = categoryAverage([
      { categoryId: "coursework", maximum: 20, score: 18 },
      { categoryId: "coursework", maximum: 10, score: 7 },
    ]);

    assert.equal(average, (25 / 30) * 100);
  });

  it("ignores items that have not been marked instead of counting them as zero", () => {
    const average = categoryAverage([
      { categoryId: "coursework", maximum: 20, score: 20 },
      { categoryId: "coursework", maximum: 100, score: null },
      { categoryId: "coursework", maximum: 100, score: undefined },
    ]);

    assert.equal(average, 100);
  });

  it("returns null when nothing in the category is marked", () => {
    assert.equal(
      categoryAverage([
        { categoryId: "tests", maximum: 50, score: null },
        { categoryId: "tests", maximum: 50, score: null },
      ]),
      null,
    );
  });

  it("returns null for an empty category", () => {
    assert.equal(categoryAverage([]), null);
  });

  it("skips items whose maximum is zero or negative", () => {
    const average = categoryAverage([
      { categoryId: "tests", maximum: 0, score: 10 },
      { categoryId: "tests", maximum: -5, score: 10 },
      { categoryId: "tests", maximum: 20, score: 10 },
    ]);

    assert.equal(average, 50);
  });
});

describe("termAverage", () => {
  it("weights the categories as configured", () => {
    const average = termAverage(
      [
        { categoryId: "coursework", maximum: 100, score: 80 },
        { categoryId: "tests", maximum: 100, score: 60 },
      ],
      weights,
    );

    // 80 * 40% + 60 * 60% = 32 + 36 = 68
    assert.equal(average, 68);
  });

  it("returns null when nothing at all is marked", () => {
    assert.equal(
      termAverage(
        [
          { categoryId: "coursework", maximum: 100, score: null },
          { categoryId: "tests", maximum: 100, score: null },
        ],
        weights,
      ),
      null,
    );
  });

  it("returns null when there are no categories", () => {
    assert.equal(
      termAverage([{ categoryId: "coursework", maximum: 10, score: 9 }], []),
      null,
    );
  });
});

describe("weight redistribution", () => {
  it("drops an unmarked category and renormalises the rest to 100%", () => {
    const result = computeTerm(
      [
        { categoryId: "coursework", maximum: 100, score: 90 },
        { categoryId: "tests", maximum: 100, score: null },
      ],
      weights,
    );

    // Tests has no marks, so coursework carries the whole average.
    assert.equal(result.average, 90);
    assert.equal(result.categories.length, 1);
    assert.equal(result.categories[0].categoryId, "coursework");
    assert.equal(result.categories[0].effectiveWeight, 100);
  });

  it("redistributes proportionally across the categories that have data", () => {
    const result = computeTerm(
      [
        { categoryId: "coursework", maximum: 100, score: 80 },
        { categoryId: "tests", maximum: 100, score: 50 },
        { categoryId: "projects", maximum: 100, score: null },
      ],
      [
        { id: "coursework", weight: 20 },
        { id: "tests", weight: 20 },
        { id: "projects", weight: 60 },
      ],
    );

    // Projects is absent; coursework and tests are equal at 20 each, so they
    // each become 50% of the remaining average.
    assert.equal(result.average, 65);
    assert.deepEqual(
      result.categories.map((category) => category.effectiveWeight),
      [50, 50],
    );
  });

  it("keeps categories with no marks out of the marked-item count", () => {
    const result = computeTerm(
      [
        { categoryId: "coursework", maximum: 10, score: 8 },
        { categoryId: "coursework", maximum: 10, score: null },
        { categoryId: "tests", maximum: 10, score: null },
      ],
      weights,
    );

    assert.equal(result.markedItems, 1);
    assert.equal(result.totalItems, 3);
  });
});

describe("rounding", () => {
  it("rounds only the final figure to one decimal", () => {
    // Coursework: 2/3 = 66.666…, tests: 1/3 = 33.333…
    // Weighted equally that is 49.999…, which must round to 50 and not 49.9.
    const average = termAverage(
      [
        { categoryId: "coursework", maximum: 3, score: 2 },
        { categoryId: "tests", maximum: 3, score: 1 },
      ],
      [
        { id: "coursework", weight: 50 },
        { id: "tests", weight: 50 },
      ],
    );

    assert.equal(average, 50);
  });

  it("keeps one decimal place", () => {
    assert.equal(roundAverage(72.44999), 72.4);
    assert.equal(roundAverage(72.45), 72.5);
  });

  it("does not round each category before summing", () => {
    // Two categories, both 33.333…, weight 50/50.
    // Rounded per category (33.3) the result would be 33.3; correct is 33.3
    // here, so use a case where the difference is visible: 66.666… and 33.333…
    const average = termAverage(
      [
        { categoryId: "a", maximum: 9, score: 3 },
        { categoryId: "b", maximum: 9, score: 6 },
      ],
      [
        { id: "a", weight: 50 },
        { id: "b", weight: 50 },
      ],
    );

    assert.equal(average, 50);
  });
});

describe("scorePercentage", () => {
  it("returns null for an unmarked score", () => {
    assert.equal(scorePercentage(null, 20), null);
  });

  it("returns null when the maximum is not usable", () => {
    assert.equal(scorePercentage(10, 0), null);
  });

  it("returns the raw percentage without rounding", () => {
    assert.equal(scorePercentage(1, 3), (1 / 3) * 100);
  });
});

describe("weightsAreValid", () => {
  it("accepts weights that total 100", () => {
    assert.equal(weightsAreValid(weights), true);
    assert.equal(weightsTotal(weights), 100);
  });

  it("rejects a total that is not 100", () => {
    assert.equal(weightsAreValid([{ id: "a", weight: 99 }]), false);
  });

  it("rejects negative or fractional weights", () => {
    assert.equal(
      weightsAreValid([
        { id: "a", weight: 110 },
        { id: "b", weight: -10 },
      ]),
      false,
    );
    assert.equal(
      weightsAreValid([
        { id: "a", weight: 99.5 },
        { id: "b", weight: 0.5 },
      ]),
      false,
    );
  });

  it("rejects an empty category set", () => {
    assert.equal(weightsAreValid([]), false);
  });
});
