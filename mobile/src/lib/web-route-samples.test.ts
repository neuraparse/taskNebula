import { parseTaskNebulaDeepLink } from './deep-links';
import { webRouteDeepLinkSamples } from './web-route-samples';

describe('web route deep-link samples', () => {
  it.each(Object.entries(webRouteDeepLinkSamples))(
    'parses %s into a native mobile intent',
    (_route, sample) => {
      expect(parseTaskNebulaDeepLink(sample.url)).toEqual(expect.objectContaining(sample.expected));
    },
  );
});
