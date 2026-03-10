import type { RealmState, RouterIntent } from "@openoctopus/shared";
import { createLogger } from "@openoctopus/shared";

const log = createLogger("router");

const REALM_KEYWORDS: Record<string, string[]> = {
  pet: ["pet", "cat", "dog", "animal", "vet", "veterinary", "puppy", "kitten", "fish", "bird"],
  finance: ["money", "budget", "invest", "bank", "tax", "salary", "expense", "payment", "stock", "crypto"],
  health: ["health", "doctor", "medicine", "symptom", "exercise", "diet", "nutrition", "vitamin", "checkup"],
  fitness: ["workout", "gym", "running", "yoga", "muscle", "weight", "cardio", "training"],
  home: ["house", "apartment", "rent", "furniture", "repair", "cleaning", "garden", "plumbing"],
  vehicle: ["car", "drive", "fuel", "insurance", "maintenance", "tire", "oil", "mechanic"],
  work: ["work", "job", "career", "office", "meeting", "project", "deadline", "colleague", "boss"],
  parents: ["parent", "mom", "dad", "mother", "father", "family"],
  partner: ["partner", "spouse", "wife", "husband", "relationship", "anniversary", "date"],
  friends: ["friend", "social", "party", "gathering", "hangout"],
  legal: ["legal", "lawyer", "contract", "law", "court", "rights", "sue", "compliance"],
  hobby: ["hobby", "book", "movie", "music", "game", "art", "craft", "photography"],
};

export class Router {
  route(message: string, realms: RealmState[]): RouterIntent {
    const lowered = message.toLowerCase();
    const _realmNames = new Set(realms.map((r) => r.name.toLowerCase()));

    let bestMatch: { realmId: string; score: number } | null = null;

    for (const realm of realms) {
      const name = realm.name.toLowerCase();
      const keywords = REALM_KEYWORDS[name] ?? [];

      let score = 0;
      for (const kw of keywords) {
        if (lowered.includes(kw)) {
          score += 1;
        }
      }

      // Direct realm name mention gets a boost
      if (lowered.includes(name)) {
        score += 3;
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { realmId: realm.id, score };
      }
    }

    if (bestMatch) {
      const confidence = Math.min(bestMatch.score / 5, 1.0);
      log.info(`Routed to realm ${bestMatch.realmId} (confidence=${confidence.toFixed(2)})`);
      return {
        targetRealmId: bestMatch.realmId,
        confidence,
        isMultiRealm: false,
      };
    }

    log.info("No realm match found, routing to general");
    return {
      confidence: 0,
      isMultiRealm: false,
      reasoning: "No realm keywords matched",
    };
  }
}
