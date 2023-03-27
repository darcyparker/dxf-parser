import * as fs from 'fs';
import * as path from 'path';
import DxfParser from '../esm/index.js';
import should from 'should';
import approvals from 'approvals';

// Note: fialOnLineEndingDifferences doesn't appear to work right now. Filed an issue with approvals.
approvals.configure({
  reporters: [
    'vscode',
    'opendiff',
    'p4merge',
    'tortoisemerge',
    'nodediff',
    'gitdiff',
  ],
  normalizeLineEndingsTo: '\n',
  EOL: '\n',
  maxLaunches: 5,
  failOnLineEndingDifferences: false,
  stripBOM: true,
});

const __dirname = path.dirname(new URL(import.meta.url).pathname);

//ltrim: Trims leading whitespace only
export const ltrim = (str) => (!str ? str : str.replace(/^\s+/g, ''));

describe('Parser', function () {
  it('should parse the dxf header variables into an object', function (done) {
    var file = fs.createReadStream(__dirname + '/data/header.dxf', {
      encoding: 'utf8',
    });
    var parser = new DxfParser();

    parser
      .parseStream(file)
      .then((result) => {
        var expected = fs.readFileSync(__dirname + '/data/header.parser.out', {
          encoding: 'utf8',
        });
        //serialize and re-parse resultJson because of `Date` objects in header
        var resultJson = JSON.parse(JSON.stringify(result));
        resultJson.should.eql(JSON.parse(expected));
        done();
        console.log('done first');
      })
      .catch((err) => {
        console.error(err);
        should.not.exist(err);
      });
  });

  var tables;

  it('should parse the tables section without error', function (done) {
    var file = fs.createReadStream(__dirname + '/data/tables.dxf', {
      encoding: 'utf8',
    });
    console.log('file read');
    var parser = new DxfParser();

    parser
      .parseStream(file)
      .then((result) => {
        console.log('parsed');
        tables = result.tables;
        console.log(__dirname);
        console.log('writing files');
        fs.writeFileSync(
          path.join(__dirname, 'data', 'layer-table.actual.json'),
          JSON.stringify(tables.layer, null, 2),
        );
        fs.writeFileSync(
          path.join(__dirname, 'data', 'ltype-table.actual.json'),
          JSON.stringify(tables.lineType, null, 2),
        );
        fs.writeFileSync(
          path.join(__dirname, 'data', 'viewport-table.actual.json'),
          JSON.stringify(tables.viewPort, null, 2),
        );
        console.log('done writing files');
        done();
      })
      .catch((err) => {
        console.error(err);
        var errMsg = err ? err.stack : undefined;
        should.not.exist(err, errMsg);
      });
  });

  it('should parse the dxf layers', function () {
    should.exist(tables);
    tables.should.have.property('layer');

    var expectedOutputFilePath = path.join(
      __dirname,
      'data',
      'layer-table.expected.json',
    );

    var expected = fs.readFileSync(expectedOutputFilePath, {
      encoding: 'utf8',
    });
    tables.layer.should.eql(JSON.parse(expected));
  });

  it('should parse the dxf ltype table', function () {
    should.exist(tables);
    tables.should.have.property('lineType');

    var expectedOutputFilePath = path.join(
      __dirname,
      'data',
      'ltype-table.expected.json',
    );

    var expected = fs.readFileSync(expectedOutputFilePath, {
      encoding: 'utf8',
    });
    tables.lineType.should.eql(JSON.parse(expected));
  });

  it('should parse the dxf viewPort table', function () {
    should.exist(tables);
    tables.should.have.property('viewPort');

    var expectedOutputFilePath = path.join(
      __dirname,
      'data',
      'viewport-table.expected.json',
    );

    var expected = fs.readFileSync(expectedOutputFilePath, {
      encoding: 'utf8',
    });
    tables.viewPort.should.eql(JSON.parse(expected));
  });

  it('should parse a complex BLOCKS section', function () {
    verifyDxf(path.join(__dirname, 'data', 'blocks.dxf'));
  });

  it('should parse a simple BLOCKS section', function () {
    var file = fs.readFileSync(path.join(__dirname, 'data', 'blocks2.dxf'), {
      encoding: 'utf8',
    });

    var parser = new DxfParser();
    var dxf;
    try {
      dxf = parser.parseSync(file);
      fs.writeFileSync(
        path.join(__dirname, 'data', 'blocks2.actual.json'),
        JSON.stringify(dxf, null, 2),
      );
    } catch (err) {
      should.not.exist(err);
    }
    should.exist(dxf);

    var expected = fs.readFileSync(
      path.join(__dirname, 'data', 'blocks2.expected.json'),
      { encoding: 'utf8' },
    );
    dxf.should.eql(JSON.parse(expected));
  });

  it('should parse POLYLINES', function () {
    verifyDxf(path.join(__dirname, 'data', 'polylines.dxf'));
  });

  it('should parse ELLIPSE entities', function () {
    var file = fs.readFileSync(path.join(__dirname, 'data', 'ellipse.dxf'), {
      encoding: 'utf8',
    });

    var parser = new DxfParser();
    var dxf;
    try {
      dxf = parser.parseSync(file);
      fs.writeFileSync(
        path.join(__dirname, 'data', 'ellipse.actual.json'),
        JSON.stringify(dxf, null, 2),
      );
    } catch (err) {
      should.not.exist(err);
    }
    should.exist(dxf);

    var expected = fs.readFileSync(
      path.join(__dirname, 'data', 'ellipse.expected.json'),
      { encoding: 'utf8' },
    );
    dxf.should.eql(JSON.parse(expected));
  });

  it('should parse SPLINE entities', function () {
    var file = fs.readFileSync(path.join(__dirname, 'data', 'splines.dxf'), {
      encoding: 'utf8',
    });

    var parser = new DxfParser();
    var dxf;
    try {
      dxf = parser.parseSync(file);
      fs.writeFileSync(
        path.join(__dirname, 'data', 'splines.actual.json'),
        JSON.stringify(dxf, null, 2),
      );
    } catch (err) {
      should.not.exist(err);
    }
    should.exist(dxf);

    var expected = fs.readFileSync(
      path.join(__dirname, 'data', 'splines.expected.json'),
      { encoding: 'utf8' },
    );
    dxf.should.eql(JSON.parse(expected));
  });

  it('should parse EXTENDED DATA', function () {
    var file = fs.readFileSync(
      path.join(__dirname, 'data', 'extendeddata.dxf'),
      { encoding: 'utf8' },
    );

    var parser = new DxfParser();
    var dxf;
    try {
      dxf = parser.parseSync(file);
      fs.writeFileSync(
        path.join(__dirname, 'data', 'extendeddata.actual.json'),
        JSON.stringify(dxf, null, 2),
      );
    } catch (err) {
      should.not.exist(err);
    }
    should.exist(dxf);

    var expected = fs.readFileSync(
      path.join(__dirname, 'data', 'extendeddata.expected.json'),
      { encoding: 'utf8' },
    );
    dxf.should.eql(JSON.parse(expected));
  });

  it('should parse SPLINE entities that are like arcs and circles', function () {
    verifyDxf(path.join(__dirname, 'data', 'arcs-as-splines.dxf'));
  });

  it('should parse ARC entities (1)', function () {
    verifyDxf(path.join(__dirname, 'data', 'arc1.dxf'));
  });

  it('should parse MTEXT entities', function () {
    verifyDxf(path.join(__dirname, 'data', 'mtext-test.dxf'));
  });

  it('should parse MULTILEADER entities', function () {
    verifyDxf(path.join(__dirname, 'data', 'mleader.dxf'));
  });

  describe('serialization', function () {
    [
      'tables.dxf',
      'blocks.dxf',
      'blocks2.dxf',
      'polylines.dxf',
      'ellipse.dxf',
      'splines.dxf',
      'extendeddata.dxf',
      'arcs-as-splines.dxf',
      'arc1.dxf',
      'mtext-test.dxf',
      'mleader.dxf',
    ].forEach((f) => {
      const sourceFilePath = path.join(__dirname, 'data', f);
      const baseName = path.basename(sourceFilePath, '.dxf');
      const roundTripFilePath = path.join(
        __dirname,
        'data',
        `${baseName}_roundtrip.dxf`,
      );
      const roundTripBaseName = path.basename(roundTripFilePath, '.dxf');

      //Commented, because there are some known failures
      //* Not all group codes are parsed/serialized.
      //* This handles skipping many cases... but not all cases that should be skipped
      //* This is still useful for debugging.
      //* A better test is the roundtrip parse => serialize => parse
      //
      //it(`should serialize parsed ${f}`, async function () {
      //  //using trim() because some files have trailing newline whitespace
      //  const original = fs
      //    .readFileSync(sourceFilePath, { encoding: 'utf8' })
      //    .trim();
      //  const skipMarker = '___skip___';
      //  const skippedCodes = new Set([
      //    '310', //binary data
      //    //extended codes
      //    '1000',
      //    '1001',
      //    '1002',
      //    '1003',
      //    '1004',
      //    '1005',
      //    '1010',
      //    '1020',
      //    '1030',
      //    '1070',
      //    '1071',
      //  ]);
      //  const originalLines = original
      //    //replace lines for subclass marker group with skipMarker
      //    .replace(
      //      /( |\t)*100(\r\n|\r|\n)( |\t)*AcDb\S+(\r\n|\r|\n)/g,
      //      `${skipMarker}\n${skipMarker}\n`,
      //    )
      //    .split(/\r\n|\r|\n/g)
      //    //skip extended codes and ltrim otherwise
      //    .map((l, index, arr) => {
      //      const line = ltrim(l);
      //      const prevLine = index > 0 ? ltrim(arr[index - 1]) : undefined;
      //      if (index % 2 === 0) {
      //        if (skippedCodes.has(line)) {
      //          return skipMarker;
      //        }
      //      } else if (skippedCodes.has(prevLine)) {
      //        return skipMarker;
      //      }
      //      return line;
      //    });

      //  const parser = new DxfParser();
      //  const dxf = parser.parse(original);

      //  fs.writeFileSync(roundTripFilePath, parser.serializeToString(dxf));

      //  let lineNum = 0;
      //  let skippedLines = 0;
      //  for (const line of parser.serialize(dxf)) {
      //    let originalLine;
      //    while (true) {
      //      originalLine = originalLines[lineNum + skippedLines];
      //      if (originalLine !== skipMarker) {
      //        break;
      //      }
      //      skippedLines++;
      //    }
      //    lineNum++;
      //    if (line != originalLine) {
      //      const parsedLine = parseFloat(line);
      //      const parsedOriginalLine = parseFloat(originalLine);
      //      if (Math.abs(parsedLine - parsedOriginalLine) < 1e-6) {
      //        //ok. It's within tolerance or
      //        //could be formatting difference of same number like '100000000000000000000.0' != '1.000000000000000E+20'
      //        //or sometimes there code groups that are for integers, but the original DXF output a float like 1.0 or 2.0 instead of 1 or 2
      //        continue;
      //      }
      //      throw new Error(
      //        `serialized line ${lineNum} does not match line ${
      //          lineNum + skippedLines
      //        } in original: '${line}' != '${originalLine}'`,
      //      );
      //    }
      //  }
      //});

      it(`parsed ${f}, serialized and parsed should yield same result`, async function () {
        const sourceDirectory = path.dirname(sourceFilePath);

        const originalFile = fs.readFileSync(sourceFilePath, {
          encoding: 'utf8',
        });

        const parser = new DxfParser();
        const originalDxf = parser.parse(originalFile);
        const serialized = parser.serializeToString(originalDxf);
        fs.writeFileSync(roundTripFilePath, serialized);
        const dxfRoundTrip = parser.parse(serialized);

        //fs.writeFileSync(
        //  path.join(
        //    __dirname,
        //    'data',
        //    `${roundTripBaseName}.json`
        //  ),
        //  JSON.stringify(dxfRoundTrip, null, 2),
        //);

        approvals.verifyAsJSON(
          sourceDirectory,
          roundTripBaseName,
          dxfRoundTrip,
        );
      });
    });
  });
});

function verifyDxf(sourceFilePath) {
  var baseName = path.basename(sourceFilePath, '.dxf');
  var sourceDirectory = path.dirname(sourceFilePath);

  var file = fs.readFileSync(sourceFilePath, { encoding: 'utf8' });

  var parser = new DxfParser();
  var dxf = parser.parse(file);

  approvals.verifyAsJSON(sourceDirectory, baseName, dxf);
}
