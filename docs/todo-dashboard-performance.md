# Dashboard Grade Injection Performance Optimization TODO

## Quick Wins (No Code Changes)

- [ ] Run performance benchmark in browser console:
  ```javascript
  await window.CG.testConcurrentPerformance()
  ```
- [ ] Document current performance metrics (courses, total time, avg per course)
- [ ] Test with different user accounts (varying course counts)

## Easy Optimizations

### 1. Increase Concurrent Workers
- [ ] Update `CONCURRENT_WORKERS` in `src/dashboard/gradeDisplay.js` (line 48)
  - Current: `const CONCURRENT_WORKERS = 3;`
  - Try: 5, 6, 7, or 8
  - Test each level and measure performance
- [ ] Monitor Canvas API rate limits (3000 requests/hour)
- [ ] Document optimal concurrency level for production

### 2. Reduce Logging Overhead
- [ ] Review log levels in production builds
- [ ] Consider setting default log level to INFO or WARN
- [ ] Remove trace/debug logs from hot paths

## Medium Effort Optimizations

### 3. Progressive/Lazy Rendering
- [ ] Render badges as soon as each course is processed (don't wait for all)
- [ ] Add loading indicators to dashboard cards
- [ ] Prioritize visible cards first (viewport detection)
- [ ] Use `requestAnimationFrame` for smoother rendering

### 4. Optimize DOM Operations
- [ ] Batch DOM updates using `DocumentFragment`
- [ ] Cache hero color calculations (avoid re-computing per card)
- [ ] Reduce DOM queries in `cardRenderer.js`
- [ ] Profile DOM manipulation performance

### 5. Bulk Data Fetching
- [ ] Investigate `populateCourseSnapshot()` API calls
- [ ] Pre-fetch all course data in bulk before processing
- [ ] Reduce per-course API calls for:
  - Course settings
  - Assignment groups
  - Grading standards
- [ ] Consider adding bulk endpoints or batch requests

## Advanced Optimizations

### 6. Caching Strategy
- [ ] Review course snapshot cache effectiveness
- [ ] Add cache warming on page load
- [ ] Implement cache invalidation strategy
- [ ] Consider localStorage/IndexedDB for persistent caching

### 7. Web Workers
- [ ] Evaluate moving heavy processing to Web Workers
- [ ] Offload JSON parsing, data transformation
- [ ] Keep DOM manipulation on main thread

### 8. Intersection Observer
- [ ] Only render badges for visible cards
- [ ] Lazy-load badges as user scrolls
- [ ] Reduce initial load time

## Testing & Validation

- [ ] Create performance benchmarks for different scenarios:
  - 5 courses
  - 10 courses
  - 20+ courses
- [ ] Test on different browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test on different network speeds (throttle to 3G/4G)
- [ ] Measure impact on Canvas page load time
- [ ] Monitor Canvas API rate limit usage

## Documentation

- [ ] Document optimal `CONCURRENT_WORKERS` setting
- [ ] Add performance tuning guide
- [ ] Document trade-offs (speed vs API limits)
- [ ] Update AUTO_PATCH_LOADER.md with performance notes

## Notes

- Current implementation uses 3 concurrent workers
- Typical performance: 1-3 seconds for 10 courses
- Target: <1 second for 10 courses
- Canvas API rate limit: 3000 requests/hour
- Performance test available: `window.CG.testConcurrentPerformance()`

