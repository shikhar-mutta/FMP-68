type PathLike = {
  followerIds?: string[] | null;
};

export type PathResponse<T extends PathLike> = T & {
  followers: string[];
};

export const asStringList = (value?: string[] | null): string[] =>
  Array.isArray(value) ? value : [];

export const withoutValue = (items: string[], value: string): string[] =>
  items.filter((item) => item !== value);

export const withValueOnce = (items: string[], value: string): string[] =>
  items.includes(value) ? items : [...items, value];

export const toPathResponse = <T extends PathLike>(
  path: T,
): PathResponse<T> => ({
  ...path,
  followers: asStringList(path.followerIds),
});

export const toPathResponses = <T extends PathLike>(
  paths: T[],
): Array<PathResponse<T>> => paths.map(toPathResponse);
