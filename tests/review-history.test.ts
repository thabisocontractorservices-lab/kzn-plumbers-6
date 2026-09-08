import { describe, expect, it } from "vitest";
import { splitReviewHistory, ratingSummary, type ReviewRecord } from "../lib/review-history";

const base:ReviewRecord={id:"a",plumber_id:"one",reviewer_id:"person",rating:5,comment:"First",created_at:"2026-09-01T12:00:00.000000Z"};
describe("current feedback and preserved history",()=>{
  it("keeps the actual latest rating rather than choosing the highest",()=>{
    const input=[base,{...base,id:"b",rating:4,comment:"Updated",created_at:"2026-09-01T12:00:01.000000Z"}];
    const result=splitReviewHistory(input);
    expect(result.current.map(r=>r.rating)).toEqual([4]);expect(result.history.map(r=>r.id)).toEqual(["a"]);
    expect(input).toHaveLength(2);expect(input[0].rating).toBe(5);
  });
  it("does not collapse distinct businesses or unknown guest identities",()=>{
    const result=splitReviewHistory([base,{...base,id:"b",plumber_id:"two"},{...base,id:"c",reviewer_id:null},{...base,id:"d",reviewer_id:null}]);
    expect(result.current).toHaveLength(4);expect(result.history).toHaveLength(0);
  });
  it("preserves microsecond ordering and stable id tie-breaks",()=>{
    const newer={...base,id:"0",created_at:"2026-09-01T12:00:00.000002Z"};
    const older={...base,id:"z",created_at:"2026-09-01T12:00:00.000001Z"};
    expect(splitReviewHistory([older,newer]).current[0].id).toBe("0");
  });
  it("ignores invalid stars when calculating a display average",()=>{
    expect(ratingSummary([base,{...base,id:"b",rating:0}])).toEqual({count:1,rating:5});
    expect(ratingSummary([])).toEqual({count:0,rating:null});
  });
});
