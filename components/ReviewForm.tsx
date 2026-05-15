"use client";

import { useState } from "react";
import { supabase } from "@/src/supabaseClient";

export function ReviewForm({ plumberId }: { plumberId: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return alert("Please pick a star rating");
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("reviews").insert({
      plumber_id: plumberId,
      reviewer_id: user?.id ?? null,
      reviewer_name: name,
      rating,
      comment: comment || null,
    });

    setSubmitting(false);
    if (error) return alert("Could not post review: " + error.message);

    setRating(0);
    setName("");
    setComment("");
    location.reload();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-gray-50 rounded-xl p-5 border border-gray-200"
    >
      <div className="font-semibold text-sm mb-3">Leave a Review</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <input
          required
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
        />
        <input placeholder="Your phone (optional)" className="input" />
      </div>
      <div className="mb-3">
        <div className="text-xs font-semibold text-gray-700 mb-1">Rating</div>
        <div className="flex gap-1 text-2xl sm:text-3xl select-none">
          {[1, 2, 3, 4, 5].map((s) => (
            <span
              key={s}
              onClick={() => setRating(s)}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              className={`cursor-pointer transition-colors ${
                s <= (hover || rating) ? "text-amber-500" : "text-gray-300"
              }`}
            >
              ★
            </span>
          ))}
        </div>
      </div>
      <textarea
        rows={3}
        placeholder="Share your experience working with this plumber..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="input resize-none"
      />
      <div className="text-right mt-3">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Posting..." : "Submit Review"}
        </button>
      </div>
    </form>
  );
}
