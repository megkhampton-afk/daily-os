/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assignments from "../assignments.js";
import type * as calendar from "../calendar.js";
import type * as calendarMatch from "../calendarMatch.js";
import type * as capture from "../capture.js";
import type * as courses from "../courses.js";
import type * as crons from "../crons.js";
import type * as emails from "../emails.js";
import type * as folders from "../folders.js";
import type * as http from "../http.js";
import type * as key from "../key.js";
import type * as mailApi from "../mailApi.js";
import type * as oauth from "../oauth.js";
import type * as schedule from "../schedule.js";
import type * as settings from "../settings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assignments: typeof assignments;
  calendar: typeof calendar;
  calendarMatch: typeof calendarMatch;
  capture: typeof capture;
  courses: typeof courses;
  crons: typeof crons;
  emails: typeof emails;
  folders: typeof folders;
  http: typeof http;
  key: typeof key;
  mailApi: typeof mailApi;
  oauth: typeof oauth;
  schedule: typeof schedule;
  settings: typeof settings;
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
