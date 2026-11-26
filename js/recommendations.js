(() => {
  function filterCourses(courses, difficulty) {
    return difficulty === '전체'
      ? courses
      : courses.filter(course => course.difficulty === difficulty);
  }

  window.TrailMateRecommendations = Object.freeze({ filterCourses });
})();
