type filterBy = "new-releases" | "coming-soon" | "available";
type platform = "ps5" | "ps4" | "xbox-series-x" | "xboxone" | "switch" | "pc" | "ios" | "stadia";
type sortBy = "date" | "metascore" | "name" | "userscore";
/**
 *  Interface GamesParamsOptions
 *  @interface
 *  @classdesc URL parameter options
 */
interface GamesParamsOptions {
    /**
     * @member {filterBy} filterBy
     */
    filterBy: filterBy;
    /**
     * @member {platform} platform
     */
    platform: platform;
    /**
     * @member {sortBy} sortBy
     */
    sortBy: sortBy;
}

/**
 *  Interface MoviesParamsOptions
 *  @interface
 *  @classdesc URL parameter options
 */
interface MoviesParamsOptions {
    /**
    * @member {string} year
    */
    year: string;
}

/**
 *  Interface TVParamsOptions
 *  @interface
 *  @classdesc URL parameter options
 */
interface TVParamsOptions {
    /**
    * @member {string} filterBy
    */
    filterBy: string;
    /**
    * @member {string} sortBy
    */
    sortBy: string;
}

/**
 *  Interface MusicParamsOptions
 *  @interface
 *  @classdesc URL parameter options
 */
interface MusicParamsOptions {
    /**
    * @member {string} filterBy
    */
    filterBy: string;
    /**
    * @member {string} sortBy
    */
    sortBy: string;
}

declare function getGameReviews(options: GamesParamsOptions): Promise<any[]>;
declare function getMoviesReviews(options: MoviesParamsOptions): Promise<any[]>;
declare function getTVReviews(options: TVParamsOptions): Promise<any[]>;
declare function getMusicReviews(options: MusicParamsOptions): Promise<any[]>;
declare function getUpcomingAlbumReleases(): Promise<{
    upcoming_album: any[];
    anticipated_album: any[];
}[]>;

export { getGameReviews, getMoviesReviews, getMusicReviews, getTVReviews, getUpcomingAlbumReleases };
