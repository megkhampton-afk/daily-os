/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apple from "../apple.js";
import type * as assignments from "../assignments.js";
import type * as caldav from "../caldav.js";
import type * as calendar from "../calendar.js";
import type * as calendarMatch from "../calendarMatch.js";
import type * as calendarVisibility from "../calendarVisibility.js";
import type * as capture from "../capture.js";
import type * as courses from "../courses.js";
import type * as crons from "../crons.js";
import type * as emails from "../emails.js";
import type * as folders from "../folders.js";
import type * as googleCalendar from "../googleCalendar.js";
import type * as http from "../http.js";
import type * as key from "../key.js";
import type * as mailApi from "../mailApi.js";
import type * as mailBatch from "../mailBatch.js";
import type * as mailMove from "../mailMove.js";
import type * as notes from "../notes.js";
import type * as oauth from "../oauth.js";
import type * as schedule from "../schedule.js";
import type * as settings from "../settings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apple: typeof apple;
  assignments: typeof assignments;
  caldav: typeof caldav;
  calendar: typeof calendar;
  calendarMatch: typeof calendarMatch;
  calendarVisibility: typeof calendarVisibility;
  capture: typeof capture;
  courses: typeof courses;
  crons: typeof crons;
  emails: typeof emails;
  folders: typeof folders;
  googleCalendar: typeof googleCalendar;
  http: typeof http;
  key: typeof key;
  mailApi: typeof mailApi;
  mailBatch: typeof mailBatch;
  mailMove: typeof mailMove;
  notes: typeof notes;
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
