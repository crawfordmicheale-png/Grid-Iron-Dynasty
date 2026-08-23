// Name and college pools. Everything in this league is fictional, colleges
// included -- the pools are large enough that duplicate names inside a single
// franchise save are rare, and the generator dedupes anyway.

export const FIRST_NAMES = [
  'Aaron','Adrian','Ahmad','Alec','Alonzo','Amari','Andre','Angelo','Anthony','Antoine',
  'Arlen','Asher','Aubrey','Austin','Avery','Barrett','Beau','Bennett','Bishop','Blaine',
  'Blake','Bo','Boone','Braden','Bradley','Brandon','Braxton','Brennan','Brett','Brock',
  'Broderick','Bryce','Byron','Cade','Caleb','Calvin','Cameron','Carson','Carter','Cedric',
  'Chance','Chandler','Chase','Chris','Clay','Clinton','Cody','Colby','Cole','Colin',
  'Colton','Connor','Corey','Cornelius','Craig','Cullen','Curtis','Dallas','Dalton','Damarcus',
  'Damian','Dane','Daniel','Dante','Darius','Darnell','Darren','Dashawn','David','Davion',
  'Deandre','Declan','Demarco','Demetrius','Denzel','Deon','Derek','Deshaun','Desmond','Devin',
  'Dexter','Dillon','Dominic','Donovan','Dorian','Drew','Duke','Dylan','Easton','Eli',
  'Elias','Elijah','Emmett','Eric','Ethan','Evan','Ezekiel','Fletcher','Foster','Franklin',
  'Gabriel','Gage','Garrett','Gavin','Gerald','Grant','Grayson','Greyson','Griffin','Hakeem',
  'Hank','Harold','Harrison','Hayden','Heath','Hendrix','Holden','Hunter','Isaiah','Ivan',
  'Jabari','Jace','Jackson','Jacoby','Jaden','Jalen','Jamal','Jameson','Jamir','Jaquan',
  'Jared','Jarrett','Jarvis','Javon','Jaxon','Jayden','Jaylen','Jefferson','Jeremiah','Jermaine',
  'Jesse','Jibril','Joel','Johnathan','Jonah','Jordan','Josiah','Judah','Julian','Justice',
  'Kade','Kaden','Kai','Kalen','Kameron','Kareem','Keegan','Keenan','Keith','Kellen',
  'Kelvin','Kendrick','Kenyon','Khalil','Kian','Kingston','Knox','Kobe','Kolton','Kyler',
  'Lamar','Lance','Landon','Lawrence','Leo','Levi','Lincoln','Logan','Lorenzo','Luca',
  'Lucas','Luther','Malachi','Malik','Marcus','Mario','Marquis','Marshall','Mason','Mateo',
  'Maurice','Maverick','Maxwell','Micah','Miles','Mitchell','Montrell','Morgan','Moses','Myles',
  'Nash','Nathan','Nehemiah','Nicholas','Nigel','Noah','Nolan','Obadiah','Octavius','Odell',
  'Omar','Orlando','Oscar','Owen','Parker','Patrick','Paxton','Payton','Percy','Perry',
  'Peyton','Phillip','Pierce','Preston','Quentin','Quincy','Quinn','Rafael','Ramsey','Randall',
  'Raheem','Rashad','Rashawn','Raymond','Reese','Reggie','Rhett','Ricardo','Richard','Ricky',
  'Riley','River','Robert','Rodney','Roman','Ronan','Roscoe','Rowan','Roy','Ruben',
  'Russell','Ryder','Sabastian','Samuel','Saquon','Sawyer','Scott','Sean','Sebastian','Shane',
  'Shaun','Sheldon','Sidney','Silas','Simeon','Solomon','Spencer','Stanley','Sterling','Stetson',
  'Stone','Sylvester','Tanner','Tariq','Tate','Tavon','Terrance','Terrell','Thaddeus','Theo',
  'Thomas','Tobias','Todd','Trace','Travis','Trent','Trevon','Trey','Tristan','Tyler',
  'Tyreek','Tyrone','Ulysses','Uriah','Vance','Vernon','Victor','Vincent','Wade','Walker',
  'Warren','Wesley','Weston','Whitaker','Wilder','Willie','Wyatt','Xander','Xavier','Zachary',
  'Zaire','Zane','Zeke','Zion',
];

export const LAST_NAMES = [
  'Abernathy','Acosta','Adams','Aguilar','Alexander','Allen','Alston','Anderson','Archer','Armstead',
  'Armstrong','Arnold','Ashford','Atkins','Austin','Avery','Bailey','Baker','Baldwin','Ballard',
  'Banks','Barfield','Barker','Barnes','Barnett','Barrett','Barron','Bass','Bates','Battle',
  'Baxter','Beasley','Beckett','Bell','Bennett','Benson','Bentley','Berry','Best','Bishop',
  'Blackmon','Blackwell','Blair','Blake','Bledsoe','Bolden','Bond','Booker','Boone','Booth',
  'Bowers','Bowman','Boyd','Bradford','Bradley','Brady','Branch','Brantley','Brewer','Bridges',
  'Briggs','Brock','Brooks','Broughton','Brown','Bruce','Bryant','Buchanan','Buckner','Bullard',
  'Burgess','Burke','Burnett','Burns','Burton','Bush','Butler','Byrd','Cade','Caldwell',
  'Calhoun','Callahan','Cameron','Campbell','Cannon','Carlisle','Carmichael','Carpenter','Carr','Carrington',
  'Carroll','Carson','Carter','Carver','Case','Casey','Castillo','Chambers','Chandler','Chapman',
  'Chase','Cherry','Christian','Clark','Clayton','Clemons','Cleveland','Clifton','Cobb','Cochran',
  'Coffey','Coleman','Collier','Collins','Colvin','Combs','Compton','Conley','Connelly','Conner',
  'Cook','Cooper','Copeland','Corbin','Cortez','Cotton','Coughlin','Cox','Crawford','Crenshaw',
  'Crockett','Cromwell','Crosby','Crowder','Culpepper','Cummings','Cunningham','Curry','Curtis','Dalton',
  'Daniels','Darby','Davenport','Davidson','Davis','Dawkins','Dawson','Day','Dean','Delaney',
  'Dennis','Devine','Dickerson','Dillard','Dixon','Dobbins','Dodson','Donaldson','Dorsey','Douglas',
  'Downing','Doyle','Drake','Draper','Drummond','Dudley','Duffy','Duncan','Dunn','Durham',
  'Eason','Easley','Eaton','Edwards','Elder','Ellington','Elliott','Ellis','Emerson','English',
  'Estes','Evans','Everett','Ewing','Fairchild','Farley','Farmer','Faulkner','Feathers','Ferguson',
  'Fields','Finley','Fisher','Fitzgerald','Fleming','Fletcher','Flowers','Floyd','Foley','Forbes',
  'Ford','Foreman','Forrest','Foster','Fowler','Fox','Francis','Franklin','Frazier','Freeman',
  'Fuller','Fulton','Gaines','Gallagher','Galloway','Gamble','Gardner','Garland','Garner','Garrett',
  'Garrison','Gaskins','Gates','Gentry','Gibbs','Gibson','Gilbert','Giles','Gill','Gilmore',
  'Givens','Glover','Godwin','Goins','Golden','Goodman','Goodwin','Gordon','Grady','Graham',
  'Grant','Graves','Grayson','Greene','Greer','Gregory','Griffin','Grimes','Grissom','Guthrie',
  'Hadley','Hale','Haley','Hall','Hamilton','Hammond','Hampton','Hancock','Haney','Hanley',
  'Hardaway','Hardin','Harding','Hardy','Hargrove','Harmon','Harper','Harrell','Harrington','Harris',
  'Harrison','Hart','Hartley','Harvey','Hastings','Hatcher','Hawkins','Hayden','Hayes','Haywood',
  'Heard','Hearst','Heath','Henderson','Hendricks','Henley','Henry','Hensley','Herndon','Hester',
  'Hicks','Higgins','Hightower','Hill','Hilliard','Hines','Hinton','Hobbs','Hodge','Hogan',
  'Holcomb','Holden','Holland','Holliday','Hollins','Holloway','Holmes','Holt','Hooper','Hoover',
  'Hopkins','Horne','Horton','Houston','Howard','Howell','Hubbard','Hudson','Huff','Hughes',
  'Humphrey','Hunt','Hunter','Hurst','Hutchins','Ingram','Irvin','Ivey','Jackson','Jacobs',
  'James','Jarrett','Jefferson','Jenkins','Jennings','Jerome','Jeter','Johnson','Jolley','Jones',
  'Jordan','Joseph','Joyner','Justice','Kane','Keaton','Keeler','Keith','Kelley','Kemp',
  'Kendrick','Kennedy','Kent','Kerr','Key','Kimble','King','Kingsley','Kinsey','Kirby',
  'Kirkland','Knight','Knox','Lacey','Ladd','Lamb','Lambert','Lancaster','Landry','Lane',
  'Langford','Langley','Larkin','Lawrence','Lawson','Leach','Leary','Ledbetter','Lee','Leonard',
  'Lester','Lewis','Liggins','Lightfoot','Lincoln','Lindsey','Little','Livingston','Lloyd','Locke',
  'Lockett','Logan','Long','Love','Lovett','Lowery','Lucas','Lynch','Lyons','Mack',
  'Maddox','Magee','Mahoney','Malloy','Malone','Mann','Manning','Marks','Marsh','Marshall',
  'Martin','Mason','Massey','Mathis','Matthews','Maxwell','Mayfield','Mays','McAllister','McBride',
  'McCall','McCarthy','McClain','McCoy','McCray','McCullough','McDaniel','McDonald','McDowell','McFadden',
  'McGee','McGill','McGrath','McIntyre','McKay','McKenzie','McKinney','McLean','McMillan','McNair',
  'McNeil','McQueen','Meadows','Melton','Mendez','Mercer','Merrick','Merritt','Metcalf','Middleton',
  'Miles','Miller','Mills','Milton','Mitchell','Monroe','Montgomery','Moody','Moon','Moore',
  'Morales','Moran','Moreland','Morgan','Morrell','Morris','Morrison','Morrow','Morton','Moses',
  'Moss','Mullins','Munoz','Murdock','Murphy','Murray','Myers','Nance','Nash','Neal',
  'Nelson','Nettles','Newell','Newman','Newsome','Newton','Nichols','Nix','Noble','Nolan',
  'Norman','Norris','Norton','Norwood','Oakley','Oakes','Odom','Oliver','Olsen','Osborne',
  'Otis','Overton','Owens','Pace','Padilla','Page','Palmer','Parham','Paris','Parker',
  'Parks','Parrish','Parsons','Patterson','Patton','Payne','Payton','Pearce','Pearson','Peck',
  'Pendleton','Penn','Perkins','Perry','Peters','Peterson','Pettis','Phelps','Phillips','Pickens',
  'Pierce','Pike','Pittman','Pitts','Poe','Polk','Pollard','Poole','Pope','Porter',
  'Potter','Powell','Powers','Prater','Pratt','Prescott','Preston','Price','Pride','Prince',
  'Pruitt','Pryor','Quarles','Quinn','Radcliffe','Rainey','Ramsey','Randall','Randolph','Rankin',
  'Ransom','Ratliff','Rawlings','Ray','Raymond','Redding','Reece','Reed','Reese','Reeves',
  'Reid','Reilly','Renfro','Reynolds','Rhodes','Rice','Richards','Richardson','Richmond','Riddick',
  'Ridley','Riggins','Riley','Rivers','Roach','Robbins','Roberson','Roberts','Robertson','Robinson',
  'Rocha','Rockwell','Rogers','Rollins','Roman','Rose','Ross','Rowe','Rowland','Roy',
  'Rucker','Rudd','Ruffin','Rush','Russell','Rutledge','Ryan','Sanchez','Sanders','Sargent',
  'Saunders','Sawyer','Scales','Schofield','Scott','Sears','Sellers','Sexton','Shanks','Sharp',
  'Shaw','Shelby','Shelton','Shepherd','Sheridan','Sherman','Shields','Short','Simmons','Simms',
  'Simpson','Sims','Sinclair','Singleton','Skinner','Slater','Sloan','Small','Smiley','Smith',
  'Snell','Snow','Snyder','Solomon','Sparks','Spears','Spencer','Spicer','Stafford','Stallings',
  'Stanley','Stanton','Stark','Starks','Steele','Stephens','Sterling','Stevens','Stewart','Stokes',
  'Stone','Stovall','Strickland','Stroud','Stuart','Sullivan','Summers','Sutton','Swain','Swann',
  'Sweeney','Sykes','Talley','Tanner','Tate','Taylor','Teague','Temple','Terrell','Terry',
  'Thacker','Thomas','Thompson','Thornton','Thorpe','Tillman','Tilley','Tinsley','Todd','Tolbert',
  'Torres','Towns','Townsend','Tracy','Travis','Trotter','Truitt','Tucker','Turner','Tyler',
  'Underwood','Upshaw','Vance','Vaughn','Vega','Venable','Vickers','Vincent','Wade','Wagner',
  'Wakefield','Walden','Waldron','Walker','Wallace','Waller','Walsh','Walters','Walton','Ward',
  'Ware','Warner','Warren','Washington','Waters','Watkins','Watson','Watts','Weaver','Webb',
  'Webster','Welch','Wells','West','Westbrook','Wheeler','Whitaker','White','Whitehead','Whitfield',
  'Whitley','Whitman','Whitney','Wiggins','Wilcox','Wilder','Wiley','Wilkerson','Wilkins','Williams',
  'Williamson','Willis','Wilson','Winfield','Wingate','Winslow','Winston','Winters','Wise','Withers',
  'Wolfe','Womack','Wood','Woodard','Woods','Woodson','Wooten','Worthy','Wray','Wright',
  'Wyatt','Yancey','Yates','York','Young','Youngblood','Zeigler','Zimmerman',
];

// Fictional colleges. Built from real-sounding place names so scouting reports
// read naturally, but none of these programs exist.
const COLLEGE_PLACES = [
  'Ashford','Baytown','Belmont','Bridgewater','Cascadia','Cedar Falls','Chandler','Clearwater',
  'Coldwater','Copper Ridge','Cumberland','Delmar','Eastvale','Fairhaven','Fallbrook','Fort Rowan',
  'Glenmoor','Granite Bay','Greenbriar','Harbor Point','Havenhill','Highland','Ironwood','Kingsbury',
  'Lakemont','Larkspur','Ledgewood','Marion','Meridian','Millbrook','Northfield','Oakhurst',
  'Pinehurst','Prairie View','Ravenswood','Redstone','Ridgemont','Riverton','Rockbridge','Saint Aubin',
  'Sandhill','Silverton','Stonegate','Summit Park','Thornton','Tidewater','Valemont','Westbrook',
  'Whitfield','Willowdale','Winterhaven','Yarborough',
];

const COLLEGE_STATES = [
  'Adaria','Calderon','Delphia','Elmoria','Fenwick','Granville','Havermore','Lorrain',
  'Marisole','Norlander','Ostrand','Petravia','Rennick','Sable','Tarrow','Verano','Westmarch',
];

const COLLEGE_SUFFIXES = [
  'State', 'Tech', 'A&M', 'University', 'College', 'Institute', 'Southern', 'Northern',
  'Western', 'Eastern', 'Central', 'Poly',
];

export function buildColleges() {
  const out = new Set();
  for (const p of COLLEGE_PLACES) {
    out.add(`${p} State`);
    out.add(`${p} Tech`);
    out.add(p);
  }
  for (const s of COLLEGE_STATES) {
    out.add(`${s} State`);
    out.add(`${s} A&M`);
    out.add(`North ${s}`);
    out.add(`South ${s}`);
    out.add(`${s} Poly`);
  }
  return Array.from(out);
}

export const COLLEGES = buildColleges();

// Programs that produce more, and better, prospects. Feeds the draft class
// generator so scouting has a texture to it.
export const BLUE_CHIP_COLLEGES = [
  'Adaria State','Marisole State','Cascadia Tech','Fort Rowan','Tidewater State',
  'Granville A&M','Ironwood Tech','Meridian State','South Sable','Westmarch State',
  'Kingsbury','Rennick Poly','Havermore State','North Lorrain','Redstone Tech',
];

export { COLLEGE_PLACES, COLLEGE_STATES, COLLEGE_SUFFIXES };
