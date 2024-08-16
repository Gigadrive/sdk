export const objectToQueryString = (obj: undefined | Record<string, any | unknown | undefined>) => {
  if (!obj) {
    return '';
  }

  return (
    '?' +
    Object.keys(obj)
      .map((key) => {
        if (obj[key] === undefined) {
          return '';
        }

        return `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`;
      })
      .join('&')
  );
};
