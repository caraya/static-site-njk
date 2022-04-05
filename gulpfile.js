/* eslint-disable require-jsdoc */
/* eslint no-unused-vars: 0, max-len: 0, no-trailing-spaces: 0  */
'use strict';
// Require Gulp first
const gulp = require('gulp');
//  packageJson = require('./package.json'),
const del = require('del');
const extReplace = require('gulp-ext-replace');

// CSS stuff
const sass = require('gulp-sass')(require('sass'));
// postcss
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');

// JS Stuff
const babel = require('gulp-babel');
const sourcemaps = require('gulp-sourcemaps');

// Image Processing
// We need path for the task to work when detecting extesions
const path = require('path');
const squoosh = require('gulp-libsquoosh');

// Static Web Server stuff
const browserSync = require('browser-sync');
// const reload = browserSync.reload;
const historyApiFallback = require('connect-history-api-fallback');

// Markdown
const fs = require('fs');
const markdown = require('gulp-markdown-it');
// load the plugins
// const abbr = require('markdown-it-abbr');
// const anc = require('markdown-it-anchor');
// const attrs = require('markdown-it-attrs');
// const embed = require('markdown-it-block-embed');
// const fn = require('markdown-it-footnote');
// const figs = require('markdown-it-implicit-figures');
// const kbd = require('markdown-it-kbd');
// const prism = require('markdown-it-prism');
// const toc = require('markdown-it-table-of-contents');
// const list = require('markdown-it-task-lists');

// Nunjucks
const nunjucks = require('nunjucks');
// const gulpnunjucks = require('gulp-nunjucks');
const nunjucksRender = require('gulp-nunjucks-render');
const grayMatter = require('gulp-gray-matter');

// Nunjucks consts for file location
const dist = 'docs';
const src = 'src';
const templates = src + '/templates';
const content = src + '/pages';

// Where to pull files from?
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(templates));

gulp.task('markdown', function() {
  const config = {
    options: {
      preset: 'commonmark',
      html: true,
      xhtmlOut: true,
      linkify: true,
      typographer: true,
    },
  };
  return gulp
      .src('src/md-source/*.md')
      .pipe(markdown(config))
      .pipe(gulp.dest('src/html-source/'));
});

gulp.task('assembleTemplate', function(done, layout = 'base') {
  // string literal for the head of the regular HTML document
  const documentTop = `---
title: Default Title
description: Default Description
---

{% extends 'layouts/${layout}.njk' %}
{% block content %}

`;

  // string literal for the footer of the regular HTML document
  const documentBottom =
`{% endblock content %}`;

  const fragmentSourceDir = 'src/html-source/';

  // read the directory
  fs.readdir(fragmentSourceDir, 'utf-8', (err, files) => {
    // if there's an error, log it to console and bail
    if (err) {
      console.error(err);
      process.exit(-1);
    }

    // For each file in the directory
    files.forEach((file) => {
      const fullPath = fragmentSourceDir + file;
      // This removes the extra .html extension from the file name
      const result = file.split('.html')[0];
      const destination = `${result}.njk`;
      // Read it
      fs.readFile(fullPath, 'utf8', (err, content) => {
        // if there's an error, log it to console and bail
        if (err) {
          console.error(err);
          process.exit(-1);
        }

        // Write the file
        const output = documentTop + content + documentBottom;
        fs.writeFileSync(`src/pages/${destination}`, output, (error) => {});
      });
    });
  });
  done();
});

gulp.task('renderContent', function() {
  return gulp.src('./src/pages/**/*.+(html|njk)')
      .pipe(nunjucksRender({
        path: ['./src/templates'],
      }))
      // output files in app folder
      .pipe(gulp.dest('./docs'));
});

// SCSS conversion and CSS processing
/**
 * @name sass
 * @description SASS conversion task to produce development css with expanded syntax.
 *
 * We run this task agains Ruby SASS, not lib SASS. As such it requires the SASS Gem to be installed
 *
 * @see {@link http://sass-lang.com|SASS}
 * @see {@link http://sass-compatibility.github.io/|SASS Feature Compatibility}
 */
gulp.task('sass', function() {
  return gulp.src('src/sass/**/*.scss')
      .pipe(sass.sync({
        outputStyle: 'expanded',
      }).on('error', sass.logError))
      .pipe(gulp.dest('./src/css'));
});

/**
 * @name processCSS
 *
 * @description Run autoprefixer on the CSS files under src/css
 *
 * Moved from gulp-autoprefixer to postcss. It may open other options in the future
 * like cssnano to compress the files
 *
 * @see {@link https://github.com/postcss/autoprefixer|autoprefixer}
 */
gulp.task('processCSS', function() {
  // What processors/plugins to use with PostCSS
  const PROCESSORS = [
    autoprefixer(),
  ];
  return gulp.src('src/css/**/*.css')
      .pipe(sourcemaps.init())
      .pipe(postcss(PROCESSORS))
      .pipe(sourcemaps.write('.'))
      .pipe(gulp.dest('docs/css'));
});

/**
 * @name babel
 * @description Transpiles ES6 to ES5 using Babel. As Node and browsers support more of the spec natively this will move to supporting ES2016 and later transpilation
 *
 * It requires the `@babel/core`, and `@babel/preset-env`
 *
 * @see {@link http://babeljs.io/|Babel}
 * @see {@link http://babeljs.io/docs/learn-es2015/|Learn ES2015}
 * @see {@link http://www.ecma-international.org/ecma-262/6.0/|ECMAScript 2015 specification}
 */
gulp.task('babel', function() {
  return gulp.src('src/es6/**/*.js')
      .pipe(gulp.sourcemaps.init())
      .pipe(gulp.babel({
        presets: ['@babel/preset-env'],
      }))
      .pipe(gulp.sourcemaps.write('.'))
      .pipe(gulp.dest('src/scripts/**/*'));
});

/**
 * @name compressImages
 * @description Squoosh all images in the src/originals folder using gulp-libsquoosh
 * @return {void}
 *
 * @see {@link https://www.npmjs.com/package/gulp-libsquoosh|gulp-libsquoosh}
 * @see {@link https://github.com/GoogleChromeLabs/squoosh/tree/dev/libsquoosh|libsquoosh}
*/
gulp.task('compressImages', function() {
  return gulp.src(['src/images/**/*.{png,jpg,webp}'])
      .pipe(
          squoosh((src) => {
            // console.log(src);
            const extname = path.extname(src.path);
            let options = {
              encodeOptions: squoosh.DefaultEncodeOptions[extname],
            };

            if (extname === '.jpg') {
              options = {
                encodeOptions: {
                  jxl: {},
                  mozjpeg: {},
                },
              };
            }

            if (extname === '.png') {
              options = {
                encodeOptions: {
                  avif: {},
                },
                preprocessOptions: {
                  quant: {
                    enabled: true,
                    numColors: 16,
                  },
                },
              };
            }

            return options;
          }),
      )
      .pipe(gulp.dest('docs/images/'));
});

/**
 * @name clean
 * @description deletes specified files
 */
gulp.task('clean', function() {
  return del([
    'docs/',
    'src/html-source/*',
    'src/pages/*',
  ]);
});

gulp.task('copy:scripts', function() {
  return gulp.src([
    'src/scripts/**/*.js',
  ])
      .pipe(gulp.dest('docs/scripts'));
});

gulp.task('copy:fonts', function() {
  return gulp.src([
    'src/fonts/**/*',
  ])
      .pipe(gulp.dest('docs/fonts'));
});

gulp.task('serve', function() {
  browserSync({
    port: 2509,
    notify: false,
    snippetOptions: {
      rule: {
        match: '<span id="browser-sync-binding"></span>',
        fn: (snippet) => {
          return snippet;
        },
      },
    },
    server: {
      baseDir: ['.tmp', 'docs'],
      middleware: [historyApiFallback()],
    },
  });
});

/**
 * @name default
 * @description uses clean, processCSS, build-template, imagemin and copy to build the HTML content from Markdown source
 */
gulp.task('default', gulp.series(
    'clean',
    'markdown',
    'assembleTemplate',
    gulp.series('sass', 'processCSS'),
    gulp.parallel('copy:scripts', 'copy:fonts'),
    'compressImages',
));
