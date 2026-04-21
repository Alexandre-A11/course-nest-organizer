import { useEffect, useState } from "react";
import { getAllCategories, subscribeCategories, type Category } from "@/lib/categories";

export function useCategories(): Category[] {
  const [cats, setCats] = useState<Category[]>(() => getAllCategories());
  useEffect(() => {
    const unsub = subscribeCategories(() => setCats(getAllCategories()));
    return () => { unsub(); };
  }, []);
  return cats;
}
