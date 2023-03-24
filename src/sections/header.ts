import type DxfArrayScanner from '../DxfArrayScanner';
import { serializeGroupValue } from '../DxfArrayScanner.js';
import { DXFSymbol } from '../DxfParser.js';
import { groupIs, serializePoint } from '../ParseHelpers.js';
import type { IPoint } from '../entities/geometry';

export type Header = Record<string, IPoint | number | string>;

//Convert autodesk's julian date to Date object
//Example from Autocase 2012 DXF reference, 'December 31, 1999, at 9:58:35 p.m. GMT' (utc), is 2451544.91568287
const julianDateToIso8601 = (jd: number): string =>
  new Date((jd - 2440588.5) * 86400000).toISOString();
const iso8601ToJulianDate = (d: string): number =>
  new Date(d).valueOf() / 86400000 + 2440588.5;

const dateNames = new Set([
  '$TDCREATE',
  '$TDUCREATE',
  '$TDUPDATE',
  '$TDUUPDATE',
]);

export const parseHeader = (scanner: DxfArrayScanner): Header => {
  // interesting variables:
  //  $ACADVER, $VIEWDIR, $VIEWSIZE, $VIEWCTR, $TDCREATE, $TDUPDATE
  // http://www.autodesk.com/techpubs/autocad/acadr14/dxf/header_section_al_u05_c.htm
  // Also see VPORT table entries
  let currVarName: null | string = null;
  let currVarValue: null | IPoint | number | string = null;
  const header: Header = {};
  // loop through header variables
  let curr = scanner.next();

  //eslint-disable-next-line no-constant-condition
  while (true) {
    if (groupIs(curr, 0, DXFSymbol.EndSec)) {
      if (currVarName) {
        header[currVarName] = currVarValue as string | number;
      }
      break;
    } else if (curr.code === 9) {
      if (currVarName) {
        header[currVarName] = currVarValue as string | number;
      }
      currVarName = curr.value as string;
      // Filter here for particular variables we are interested in
    } else {
      if (curr.code === 10) {
        currVarValue = { x: curr.value as number } as IPoint;
      } else if (curr.code === 20) {
        (currVarValue as IPoint).y = curr.value as number;
      } else if (curr.code === 30) {
        (currVarValue as IPoint).z = curr.value as number;
      } else {
        currVarValue = dateNames.has(currVarName as string)
          ? julianDateToIso8601(curr.value as number)
          : (curr.value as number | string);
      }
    }
    curr = scanner.next();
  }
  // console.log(util.inspect(header, { colors: true, depth: null }));
  scanner.next(); // swallow up ENDSEC
  return header;
};

// prettier-ignore
const codeByName = new Map<string, number>([
  ['$ACADMAINTVER', 70], //Maintenance version number
  ['$ACADVER', 1], //The AutoCAD drawing database version number:
  ['$ANGBASE', 50], //Angle 0 direction
  ['$ANGDIR', 70], //1 = Clockwise angles, 0 = Counterclockwise angles
  ['$ATTMODE', 70], //Attribute visibility: 0 = None; 1 = Normal; 2 = All
  ['$AUNITS', 70], //Units format for angles
  ['$AUPREC', 70], //Units precision for angles
  ['$CECOLOR', 62], //Current entity color number: 0 = BYBLOCK; 256 = BYLAYER
  ['$CELTSCALE', 40], //Current entity linetype scale
  ['$CELTYPE', 6], //Entity linetype name, or BYBLOCK or BYLAYER
  ['$CELWEIGHT', 370], //Lineweight of new objects
  ['$CEPSNID', 390], //Plotstyle handle of new objects; if CEPSNTYPE is 3, then this value indicates the handle
  ['$CEPSNTYPE', 380], //Plot style type of new objects: 0 = Plot style by layer; 1 = Plot style by block; 2 = Plot style by dictionary default; 3 = Plot style by object ID/handle
  ['$CHAMFERA', 40], //First chamfer distance
  ['$CHAMFERB', 40], //Second chamfer distance
  ['$CHAMFERC', 40], //Chamfer length
  ['$CHAMFERD', 40], //Chamfer angle
  ['$CLAYER', 8], //Current layer name
  ['$CMLJUST', 70], //Current multiline justification: 0 = Top; 1 = Middle; 2 = Bottom
  ['$CMLSCALE', 40], //Current multiline scale
  ['$CMLSTYLE', 2], //Current multiline style name
  ['$CSHADOW', 280], //Shadow mode for a 3D object: 0 = Casts and receives shadows; 1 = Casts shadows; 2 = Receives shadows; 3 = Ignores shadows
  ['$DIMADEC', 70], //Number of precision places displayed in angular dimensions
  ['$DIMALT', 70], //Alternate unit dimensioning performed if nonzero
  ['$DIMALTD', 70], //Alternate unit decimal places
  ['$DIMALTF', 40], //Alternate unit scale factor
  ['$DIMALTRND', 40], //Determines rounding of alternate units
  ['$DIMALTTD', 70], //Number of decimal places for tolerance values of an alternate units dimension
  ['$DIMALTTZ', 70], //Controls suppression of zeros for alternate tolerance values: 0 = Suppresses zero feet and precisely zero inches; 1 = Includes zero feet and precisely zero inches; 2 = Includes zero feet and suppresses zero inches; 3 = Includes zero inches and suppresses zero feet
  ['$DIMALTU', 70], //Units format for alternate units of all dimension style family members except angular: 1 = Scientific; 2 = Decimal; 3 = Engineering; 4 = Architectural (stacked); 5 = Fractional (stacked); 6 = Architectural; 7 = Fractional
  ['$DIMALTZ', 70], //Controls suppression of zeros for alternate unit dimension values: 0 = Suppresses zero feet and precisely zero inches; 1 = Includes zero feet and precisely zero inches; 2 = Includes zero feet and suppresses zero inches; 3 = Includes zero inches and suppresses zero feet
  ['$DIMAPOST', 1], //Alternate dimensioning suffix
  ['$DIMASO', 70], //1 = Create associative dimensioning; 0 = Draw individual entities
  ['$DIMASSOC', 280], //Controls the associativity of dimension objects 0 = Creates exploded dimensions; there is no association between elements of the dimension, and the lines, arcs, arrowheads, and text of a dimension are drawn as separate objects; 1 = Creates non-associative dimension objects; the elements of the dimension are formed into a single object, and if the definition point on the object moves, then the dimension value is updated; 2 = Creates associative dimension objects; the elements of the dimension are formed into a single object and one or more definition points of the dimension are coupled with association points on geometric objects
  ['$DIMASZ', 40], //Dimensioning arrow size
  ['$DIMATFIT', 70], // Controls dimension text and arrow placement when space is not sufficient to place both within the extension lines: 0 = Places both text and arrows outside extension lines; 1 = Moves arrows first, then text; 2 = Moves text first, then arrows; 3 = Moves either text or arrows, whichever fits best AutoCAD adds a leader to moved dimension text when DIMTMOVE is set to 1
  ['$DIMAUNIT', 70], // Angle format for angular dimensions: 0 = Decimal degrees; 1 = Degrees/minutes/seconds; 2 = Gradians; 3 = Radians; 4 = Surveyor's units
  ['$DIMAZIN', 70], // Controls suppression of zeros for angular dimensions: 0 = Displays all leading and trailing zeros; 1 = Suppresses leading zeros in decimal dimensions; 2 = Suppresses trailing zeros in decimal dimensions; 3 = Suppresses leading and trailing zeros
  ['$DIMBLK', 1], // Arrow block name
  ['$DIMBLK1', 1], // First arrow block name
  ['$DIMBLK2', 1], // Second arrow block name
  ['$DIMCEN', 40], // Size of center mark/lines
  ['$DIMCLRD', 70], // Dimension line color: range is 0 = BYBLOCK; 256 = BYLAYER
  ['$DIMCLRE', 70], // Dimension extension line color: range is 0 = BYBLOCK; 256 = BYLAYER
  ['$DIMCLRT', 70], // Dimension text color: range is 0 = BYBLOCK; 256 = BYLAYER
  ['$DIMDEC', 70], // Number of decimal places for the tolerance values of a primary units dimension
  ['$DIMDLE', 40], // Dimension line extension
  ['$DIMDLI', 40], // Dimension line increment
  ['$DIMDSEP', 70], // Single-character decimal separator used when creating dimensions whose unit format is decimal
  ['$DIMEXE', 40], // Extension line extension
  ['$DIMEXO', 40], // Extension line offset
  ['$DIMFAC', 40], //Scale factor used to calculate the height of text for dimension fractions and tolerances. AutoCAD multiplies DIMTXT by DIMTFAC to set the fractional or tolerance text height
  ['$DIMGAP', 40], // Dimension line gap
  ['$DIMJUST', 70], // Horizontal dimension text position: 0 = Above dimension line and center-justified between extension lines; 1 = Above dimension line and next to first extension line; 2 = Above dimension line and next to second extension line; 3 = Above and center-justified to first extension line; 4 = Above and center-justified to second extension line
  ['$DIMLDRBLK', 1], // Arrow block name for leaders
  ['$DIMLFAC', 40], // Linear measurements scale factor
  ['$DIMLIM', 70], // Dimension limits generated if nonzero
  ['$DIMLUNIT', 70], // Sets units for all dimension types except Angular: 1 = Scientific; 2 = Decimal; 3 = Engineering; 4 = Architectural; 5 = Fractional; 6 = Windows desktop
  ['$DIMLWD', 70], // Dimension line lineweight: -3 = Standard -2 = ByLayer -1 = ByBlock 0-211 = an integer representing 100th of mm
  ['$DIMLWE', 70], // Extension line lineweight: -3 = Standard -2 = ByLayer -1 = ByBlock 0-211 = an integer representing 100th of mm
  ['$DIMPOST', 1], // General dimensioning suffix
  ['$DIMRND', 40], // Rounding value for dimension distances
  ['$DIMSAH', 70], // Use separate arrow blocks if nonzero
  ['$DIMSCALE', 40], // Overall dimensioning scale factor
  ['$DIMSD1', 70], // Suppression of first extension line: 0 = Not suppressed; 1 = Suppressed
  ['$DIMSD2', 70], // Suppression of second extension line: 0 = Not suppressed; 1 = Suppressed
  ['$DIMSE1', 70], // First extension line suppressed if nonzero
  ['$DIMSE2', 70], // Second extension line suppressed if nonzero
  ['$DIMSHO', 70], // 1 = Recompute dimensions while dragging 0 = Drag original image
  ['$DIMSOXD', 70], // Suppress outside-extensions dimension lines if nonzero
  ['$DIMSTYLE', 2], // Dimension style name
  ['$DIMTAD', 70], // Text above dimension line if nonzero
  ['$DIMTDEC', 70], // Number of decimal places to display the tolerance values
  ['$DIMTFAC', 40], // Dimension tolerance display scale factor
  ['$DIMTIH', 70], // Text inside horizontal if nonzero
  ['$DIMTIX', 70], // Force text inside extensions if nonzero
  ['$DIMTM', 40], // Minus tolerance
  ['$DIMTMOVE', 70], // Dimension text movement rules: 0 = Moves the dimension line with dimension text; 1 = Adds a leader when dimension text is moved; 2 = Allows text to be moved freely without a leader
  ['$DIMTOFL', 70], // If text is outside extensions, force line extensions between extensions if nonzero
  ['$DIMTOH', 70], // Text outside horizontal if nonzero
  ['$DIMTOL', 70], // Dimension tolerances generated if nonzero
  ['$DIMTOLJ', 70], // Vertical justification for tolerance values: 0 = Top; 1 = Middle; 2 = Bottom
  ['$DIMTP', 40], // Plus tolerance
  ['$DIMTSZ', 40], // Dimensioning tick size: 0 = No ticks
  ['$DIMTVP', 40], // Text vertical position
  ['$DIMTXSTY', 7], // Dimension text style
  ['$DIMTXT', 40], // Dimensioning text height
  ['$DIMTZIN', 70], // Controls suppression of zeros for tolerance values: 0 = Suppresses zero feet and precisely zero inches; 1 = Includes zero feet and precisely zero inches; 2 = Includes zero feet and suppresses zero inches; 3 = Includes zero inches and suppresses zero feet
  ['$DIMUPT', 70], // Cursor functionality for user-positioned text: 0 = Controls only the dimension line location; 1 = Controls the text position as well as the dimension line location
  ['$DIMZIN', 70], // Controls suppression of zeros for primary unit values: 0 = Suppresses zero feet and precisely zero inches; 1 = Includes zero feet and precisely zero inches; 2 = Includes zero feet and suppresses zero inches; 3 = Includes zero inches and suppresses zero feet
  ['$DISPSILH', 70], // Controls the display of silhouette curves of body objects in Wireframe mode: 0 = Off; 1 = On
  ['$DRAGVS', 349], // Hard-pointer ID to visual style while creating 3D solid primitives. The default value is NULL
  ['$DWGCODEPAGE', 3], // Drawing code page; set to the system code page when a new drawing is created, but not otherwise maintained by AutoCAD
  ['$ELEVATION', 40], // Current elevation set by ELEV command
  ['$ENDCAPS', 280], // Lineweight endcaps setting for new objects: 0 = none; 1 = round; 2 = angle; 3 = square
  ['$EXTNAMES', 290], // Controls symbol table naming: 0 = Release 14 compatibility. Limits names to 31 characters in length. Names can include the letters A to Z, the numerals 0 to 9, and the special characters dollar sign ($), underscore (_), and hyphen (-).; 1 = AutoCAD 2000. Names can be up to 255 characters in length, and can include the letters A to Z, the numerals 0 to 9, spaces, and any special characters not used for other purposes by Microsoft Windows and AutoCAD
  ['$FILLETRAD', 40], // Fillet radius
  ['$FILLMODE', 70], // Fill mode on if nonzero
  ['$FINGERPRINTGUID', 2], // Set at creation time, uniquely identifies a particular drawing
  ['$HALOGAP', 280], // Specifies a gap to be displayed where an object is hidden by another object; the value is specified as a percent of one unit and is independent of the zoom level. A haloed line is shortened at the point where it is hidden when HIDE or the Hidden option of SHADEMODE is used
  ['$HANDSEED', 5], // Next available handle
  ['$HIDETEXT', 290], // Specifies HIDETEXT system variable: 0 = HIDE ignores text objects when producing the hidden view; 1 = HIDE does not ignore text objects
  ['$HYPERLINKBASE', 1], //Path for all relative hyperlinks in the drawing. If null, the drawing path is used
  ['$INDEXCTL', 280], // 0 = No indexes are created; 1 = Layer index is created; 2 = Spatial index is created; 3 = Layer and spatial indexes are created
  ['$INSUNITS', 70], // Default drawing units for AutoCAD DesignCenter blocks: 0 = Unitless; 1 = Inches; 2 = Feet; 3 = Miles; 4 = Millimeters; 5 = Centimeters; 6 = Meters; 7 = Kilometers; 8 = Microinches; 9 = Mils; 10 = Yards; 11 = Angstroms; 12 = Nanometers; 13 = Microns; 14 = Decimeters; 15 = Decameters; 16 = Hectometers; 17 = Gigameters; 18 = Astronomical units; 19 = Light years; 20 = Parsecs
  ['$INTERFERECOLOR', 62], // Hard-pointer ID to the visual style for interference objects. Default visual style is Conceptual.
  ['$INTERFEREOBJVS', 345], // Hard-pointer ID to the visual style for the viewport during interference checking. Default visual style is 3d Wireframe.
  ['$INTERFEREVPVS', 346], // $INTERSECTIONCOLOR 70 Specifies the entity color of intersection polylines: Values 1-255 designate an AutoCAD color index (ACI); 0 = Color BYBLOCK; 256 = Color BYLAYER; 257 = Color BYENTITY
  ['$INTERSECTIONDISPLAY', 290], // Specifies the display of intersection polylines: 0 = Turns off the display of intersection polylines; 1 = Turns on the display of intersection polylines
  ['$JOINSTYLE', 280], // Lineweight joint setting for new objects: 0=none; 1= round; 2 = angle; 3 = flat
  ['$LIMCHECK', 70], // Nonzero if limits checking is on
  ['$LTSCALE', 40], // Global linetype scale
  ['$LUNITS', 70], // Units format for coordinates and distances
  ['$LUPREC', 70], // Units precision for coordinates and distances
  ['$LWDISPLAY', 290], // Controls the display of lineweights on the Model or Layout tab: 0 = Lineweight is not displayed; 1 = Lineweight is displayed
  ['$MAXACTVP', 70], // Sets maximum number of viewports to be regenerated
  ['$MEASUREMENT', 70], // Sets drawing units: 0 = English; 1 = Metric
  ['$MENU', 1], // Name of menu file
  ['$MIRRTEXT', 70], // Mirror text if nonzero
  ['$OBSCOLOR', 70], // Specifies the color of obscured lines. An obscured line is a hidden line made visible by changing its color and linetype and is visible only when the HIDE or SHADEMODE command is used. The OBSCUREDCOLOR setting is visible only if the OBSCUREDLTYPE is turned ON by setting it to a value other than 0. 0 and 256 = Entity color; 1-255 = An AutoCAD color index (ACI)
  ['$OBSLTYPE', 280], // Specifies the linetype of obscured lines. Obscured linetypes are independent of zoom level, unlike regular AutoCAD linetypes. Value 0 turns off display of obscured lines and is the default. Linetype values are defined as follows: 0 = Off; 1 = Solid; 2 = Dashed; 3 = Dotted; 4 = Short Dash; 5 = Medium Dash; 6 = Long Dash; 7 = Double Short Dash; 8 = Double Medium Dash; 9 = Double Long Dash; 10 = Medium Long Dash; 11 = Sparse Dot;
  ['$ORTHOMODE', 70], // Ortho mode on if nonzero
  ['$PDMODE', 70], // Point display mode
  ['$PDSIZE', 40], // Point display size
  ['$PELEVATION', 40], // Current paper space elevation
  ['$PLIMCHECK', 70], // Limits checking in paper space when nonzero
  ['$PLINEGEN', 70], // Governs the generation of linetype patterns around the vertices of a 2D polyline: 1 = Linetype is generated in a continuous pattern around vertices of the polyline; 0 = Each segment of the polyline starts and ends with a dash
  ['$PLINEWID', 40], // Default polyline width
  ['$PROJECTNAME', 1], // Assigns a project name to the current drawing. Used when an external reference or image is not found on its original path. The project name points to a section in the registry that can contain one or more search paths for each project name defined. Project names and their search directories are created from the Files tab of the Options dialog box
  ['$PROXYGRAPHICS', 70], // Controls the saving of proxy object images
  ['$PSLTSCALE', 70], // Controls paper space linetype scaling: 1 = No special linetype scaling; 0 = Viewport scaling governs linetype scaling
  ['$PSTYLEMODE', 290], // Indicates whether the current drawing is in a Color-Dependent or Named Plot Style mode: 0 = Uses named plot style tables in the current drawing; 1 = Uses color-dependent plot style tables in the current drawing
  ['$PSVPSCALE', 40], // View scale factor for new viewports: 0 = Scaled to fit; >0 = Scale factor (a positive real value)
  ['$PUCSBASE', 2], // Name of the UCS that defines the origin and orientation of orthographic UCS settings (paper space only)
  ['$PUCSNAME', 2], // Current paper space UCS name
  ['$PUCSORTHOREF', 2], // If paper space UCS is orthographic (PUCSORTHOVIEW not equal to 0), this is the name of the UCS that the orthographic UCS is relative to. If blank, UCS is relative to WORLD
  ['$PUCSORTHOVIEW', 70], // Orthographic view type of paper space UCS: 0 = UCS is not orthographic; 1 = Top; 2 = Bottom; 3 = Front; 4 = Back; 5 = Left; 6 = Right
  ['$QTEXTMODE', 70], // Quick Text mode on if nonzero
  ['$REGENMODE', 70], // REGENAUTO mode on if nonzero
  ['$SHADEDGE', 70], // 0 = Faces shaded, edges not highlighted; 1 = Faces shaded, edges highlighted in black; 2 = Faces not filled, edges in entity color; 3 = Faces in entity color, edges in black
  ['$SHADEDIF', 70], // Percent ambient/diffuse light; range 1-100; default 70
  ['$SHADOWPLANELOCATION', 40], // //Location of the ground shadow plane. This is a Z axis ordinate.
  ['$SKETCHINC', 40], // Sketch record increment
  ['$SKPOLY', 70], // 0 = Sketch lines; 1 = Sketch polylines
  ['$SORTENTS', 280], // Controls the object sorting methods; accessible from the Options dialog box User Preferences tab. SORTENTS uses the following bitcodes: 0 = Disables SORTENTS; 1 = Sorts for object selection; 2 = Sorts for object snap; 4 = Sorts for redraws; 8 = Sorts for MSLIDE command slide creation; 16 = Sorts for REGEN commands; 32 = Sorts for plotting; 64 = Sorts for PostScript output;
  ['$SPLINESEGS', 70], // Number of line segments per spline patch
  ['$SPLINETYPE', 70], // Spline curve type for PEDIT Spline
  ['$SURFTAB1', 70], // Number of mesh tabulations in first direction
  ['$SURFTAB2', 70], // Number of mesh tabulations in second direction
  ['$SURFTYPE', 70], // Surface type for PEDIT Smooth
  ['$SURFU', 70], // Surface density (for PEDIT Smooth) in M direction
  ['$SURFV', 70], // Surface density (for PEDIT Smooth) in N direction
  ['$TDCREATE', 40], // Local date/time of drawing creation (see “Special Handling of Date/Time Variables”)
  ['$TDINDWG', 40], // Cumulative editing time for this drawing (see “Special Handling of Date/Time Variables”)
  ['$TDUCREATE', 40], // Universal date/time the drawing was created (see “Special Handling of Date/Time Variables”)
  ['$TDUPDATE', 40], // Local date/time of last drawing update (see “Special Handling of Date/Time Variables”)
  ['$TDUSRTIMER', 40], // User-elapsed timer
  ['$TDUUPDATE', 40], // Universal date/time of the last update/save (see “Special Handling of Date/Time Variables”)
  ['$TEXTSIZE', 40], // Default text height
  ['$TEXTSTYLE', 7], // Current text style name
  ['$THICKNESS', 40], // Current thickness set by ELEV command
  ['$TILEMODE', 70], // 1 for previous release compatibility mode; 0 otherwise
  ['$TRACEWID', 40], // Default trace width
  ['$TREEDEPTH', 70], // Specifies the maximum depth of the spatial index
  ['$UCSBASE', 2], // Name of the UCS that defines the origin and orientation of orthographic UCS settings
  ['$UCSNAME', 2], // Name of current UCS
  ['$UCSORTHOREF', 2], // If model space UCS is orthographic (UCSORTHOVIEW not equal to 0), this is the name of the UCS that the orthographic UCS is relative to. If blank, UCS is relative to WORLD
  ['$UCSORTHOVIEW', 70], // Orthographic view type of model space UCS: 0 = UCS is not orthographic; 1 = Top; 2 = Bottom; 3 = Front; 4 = Back; 5 = Left; 6 = Right
  ['$UNITMODE', 70], // Low bit set = Display fractions, feet-and-inches, and surveyor's angles in input format
  ['$USERI1', 70], // First integer variables intended for use by third-party developers
  ['$USERI2', 70], // Second integer variables intended for use by third-party developers
  ['$USERI3', 70], // Third integer variables intended for use by third-party developers
  ['$USERI4', 70], // Fourth integer variables intended for use by third-party developers
  ['$USERI5', 70], // Fifth integer variables intended for use by third-party developers
  ['$USERR1', 40], // First real variables intended for use by third-party developers
  ['$USERR2', 40], // Second real variables intended for use by third-party developers
  ['$USERR3', 40], // Third real variables intended for use by third-party developers
  ['$USERR4', 40], // Fourth real variables intended for use by third-party developers
  ['$USERR5', 40], // Fifth real variables intended for use by third-party developers
  ['$USRTIMER', 70], // 0 = Timer off; 1 = Timer on
  ['$VERSIONGUID', 2], // Uniquely identifies a particular version of a drawing. Updated when the drawing is modified
  ['$VISRETAIN', 70], // 0 = Don't retain xref-dependent visibility settings 1 = Retain xref-dependent visibility settings
  ['$WORLDVIEW', 70], // 1 = Set UCS to WCS during DVIEW/VPOINT; 0 = Don't change UCS
  ['$XCLIPFRAME', 290], // Controls the visibility of xref clipping boundaries: 0 = Clipping boundary is not visible; 1 = Clipping boundary is visible
  ['$XEDIT', 290], // Controls whether the current drawing can be edited inplace when being referenced by another drawing. 0 = Can't use in-place reference editing; 1 = Can use in-place reference editig

  //Revised VPORT header variables (applies to before AutoCAD Release 11)
  ['$FASTZOOM', 70], // Fast zoom enabled if nonzero
  ['$GRIDMODE', 70], // Grid mode on if nonzero
  ['$SNAPANG', 50], // Snap grid rotation angle
  ['$SNAPISOPAIR', 70], // Isometric plane: 0 = Left; 1 = Top; 2 = Right
  ['$SNAPMODE', 70], // Snap mode on if nonzero
  ['$SNAPSTYLE', 70], // Snap style: 0 = Standard; 1 = Isometric
  ['$VIEWSIZE', 40], // Height of view

  ['$REQUIREDVERSIONS', 160],  //r2013+
  ['$LASTSAVEDBY', 1],
  ['$DIMFRAC', 70],
  ['$DIMFXL', 40],
  ['$DIMFXLON', 70],
  ['$DIMJOGANG', 40],
  ['$DIMTFILL', 70],
  ['$DIMTFILLCLR', 70],
  ['$DIMARCSYM', 70],
  ['$DIMLTYPE', 6],
  ['$DIMLTEX1', 6],
  ['$DIMLTEX2', 6],
  ['$DIMTXTDIRECTION', 70],
  ['$SPLFRAME', 70],
  ['$STYLESHEET', 1],
  ['$OLESTARTUP', 290],
  ['$INTERSECTIONCOLOR', 70],
  ['$CAMERADISPLAY', 290],
  ['$LENSLENGTH', 40],
  ['$CAMERAHEIGHT', 40],
  ['$STEPSPERSEC', 40],
  ['$STEPSIZE', 40],
  ['$3DDWFPREC', 40],
  ['$PSOLWIDTH', 40],
  ['$PSOLHEIGHT', 40],
  ['$LOFTANG1', 40],
  ['$LOFTANG2', 40],
  ['$LOFTMAG1', 40],
  ['$LOFTMAG2', 40],
  ['$LOFTPARAM', 70],
  ['$LOFTNORMALS', 280],
  ['$LATITUDE', 40],
  ['$LONGITUDE', 40],
  ['$NORTHDIRECTION', 40],
  ['$TIMEZONE', 70],
  ['$LIGHTGLYPHDISPLAY', 280],
  ['$TILEMODELIGHTSYNCH', 280],
  ['$CMATERIAL', 347],
  ['$SOLIDHIST', 280],
  ['$SHOWHIST', 280],
  ['$DWFFRAME', 280],
  ['$DGNFRAME', 280],
  ['$REALWORLDSCALE', 290],
]);

// prettier-ignore
const pointNames = new Set<string>([
  '$EXTMAX', // X, Y, and Z drawing extents upper-right corner (in WCS)
  '$EXTMIN', // X, Y, and Z drawing extents lower-left corner (in WCS)
  '$INSBASE', // Insertion base set by BASE command (in WCS)
  '$LIMMAX', // XY drawing limits upper-right corner (in WCS)
  '$LIMMIN', // XY drawing limits lower-left corner (in WCS)
  '$PEXTMAX', // Maximum X, Y, and Z extents for paper space
  '$PEXTMIN', // Minimum X, Y, and Z extents for paper space
  '$PINSBASE', // Paper space insertion base point
  '$PLIMMAX', // Maximum X and Y limits in paper space
  '$PLIMMIN', // Minimum X and Y limits in paper space
  '$PUCSORG', // Current paper space UCS origin
  '$PUCSORGBACK', // Point which becomes the new UCS origin after changing paper space UCS to BACK when PUCSBASE is set to WORLD
  '$PUCSORGBOTTOM', // Point which becomes the new UCS origin after changing paper space UCS to BOTTOM when PUCSBASE is set to WORLD
  '$PUCSORGFRONT', // Point which becomes the new UCS origin after changing paper space UCS to FRONT when PUCSBASE is set to WORLD
  '$PUCSORGLEFT', // Point which becomes the new UCS origin after changing paper space UCS to LEFT when PUCSBASE is set to WORLD
  '$PUCSORGRIGHT', // Point which becomes the new UCS origin after changing paper space UCS to RIGHT when PUCSBASE is set to WORLD
  '$PUCSORGTOP', // Point which becomes the new UCS origin after changing paper space UCS to TOP when PUCSBASE is set to WORLD
  '$PUCSXDIR', // Current paper space UCS X axis
  '$PUCSYDIR', // Current paper space UCS Y axis
  '$UCSORG', // Origin of current UCS (in WCS)
  '$UCSORGBACK', // Point which becomes the new UCS origin after changing model space UCS to BACK when UCSBASE is set to WORLD
  '$UCSORGTOP', // Point which becomes the new UCS origin after changing model space UCS to TOP when UCSBASE is set to WORLD
  '$UCSORGBOTTOM', // Point which becomes the new UCS origin after changing model space UCS to BOTTOM when UCSBASE is set to WORLD
  '$UCSORGFRONT', // Point which becomes the new UCS origin after changing model space UCS to FRONT when UCSBASE is set to WORLD
  '$UCSORGLEFT', // Point which becomes the new UCS origin after changing model space UCS to LEFT when UCSBASE is set to WORLD
  '$UCSORGRIGHT', // Point which becomes the new UCS origin after changing model space UCS to RIGHT when UCSBASE is set to WORLD
  '$UCSORGRIGHT', // Point which becomes the new UCS origin after changing model space UCS to TOP when UCSBASE is set to WORLD
  '$UCSXDIR', // Direction of the current UCS X axis (in WCS)
  '$UCSYDIR', // Direction of the current UCS Y axis (in WCS)

  //Revised VPORT header variables (applies to before AutoCAD Release 11)
  '$GRIDUNIT', //Grid X and Y spacing
  '$SNAPBASE', //Snap/grid base point (in UCS)
  '$SNAPUNIT', //Snap grid X and Y spacing
  '$VIEWCTR', //XY center of current view on screen
  '$VIEWDIR', //Viewing direction (direction from target in WCS)
]);

export const serializeHeader = function* (
  header: Header,
): IterableIterator<string> {
  //section name
  yield '2';
  yield DXFSymbol.Header;

  for (const [name, value] of Object.entries(header) as [
    keyof Header,
    Header[keyof Header],
  ][]) {
    if (pointNames.has(name) && value != null && typeof value === 'object') {
      yield '9';
      yield name;
      yield* serializePoint(value as IPoint, 10);
    } else {
      const code = codeByName.get(name);
      if (code != null) {
        yield '9';
        yield name;
        if (dateNames.has(name) && typeof value === 'string') {
          yield `${code}`;
          yield `${iso8601ToJulianDate(value)}`;
        } else {
          yield* serializeGroupValue(code, value as string | number | boolean);
        }
      }
      //otherwise unknown header name
    }
  }
};
