type CourseLink = { code: string; gradescopeUrl?: string };

function courseCode(text: string) {
  return text.match(/\b(?:\d+|[a-z]{2,})\.\d+[a-z]?\b/i)?.[0].toLowerCase();
}

export function gradescopeUrl(
  assignment: { course: string; gradescopeUrl?: string },
  courses: CourseLink[],
): string | undefined {
  if (assignment.gradescopeUrl) return assignment.gradescopeUrl;
  const exact = courses.find((course) => course.code.trim().toLowerCase() === assignment.course.trim().toLowerCase());
  if (exact?.gradescopeUrl) return exact.gradescopeUrl;
  const code = courseCode(assignment.course);
  if (!code) return undefined;
  const matches = courses.filter((course) => course.gradescopeUrl && courseCode(course.code) === code);
  return matches.length === 1 ? matches[0].gradescopeUrl : undefined;
}
