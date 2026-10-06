/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as http from "../http.js";
import type * as lib_confidence from "../lib/confidence.js";
import type * as lib_diagnostics from "../lib/diagnostics.js";
import type * as lib_evaluation from "../lib/evaluation.js";
import type * as lib_factQuality from "../lib/factQuality.js";
import type * as lib_facts from "../lib/facts.js";
import type * as lib_realtime from "../lib/realtime.js";
import type * as lib_resultWire from "../lib/resultWire.js";
import type * as lib_rubric from "../lib/rubric.js";
import type * as lib_rules from "../lib/rules.js";
import type * as lib_state from "../lib/state.js";
import type * as lib_transcription from "../lib/transcription.js";
import type * as lib_transcriptionDiagnostics from "../lib/transcriptionDiagnostics.js";
import type * as practice from "../practice.js";
import type * as scoring from "../scoring.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  http: typeof http;
  "lib/confidence": typeof lib_confidence;
  "lib/diagnostics": typeof lib_diagnostics;
  "lib/evaluation": typeof lib_evaluation;
  "lib/factQuality": typeof lib_factQuality;
  "lib/facts": typeof lib_facts;
  "lib/realtime": typeof lib_realtime;
  "lib/resultWire": typeof lib_resultWire;
  "lib/rubric": typeof lib_rubric;
  "lib/rules": typeof lib_rules;
  "lib/state": typeof lib_state;
  "lib/transcription": typeof lib_transcription;
  "lib/transcriptionDiagnostics": typeof lib_transcriptionDiagnostics;
  practice: typeof practice;
  scoring: typeof scoring;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
