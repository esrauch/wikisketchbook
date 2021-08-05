const yaml = require('yaml')
const fs = require('fs')
const M = require('mustache')

function recursiveLs(dir) {
    const files = fs.readdirSync(dir).map(f => `${dir}/${f}`)
    return files.flatMap(f => {
        if (fs.statSync(f).isDirectory()) {
            return recursiveLs(f)
        }
        return f;
    })
}

const allPosts = recursiveLs('src/posts')
    .filter(name => name.endsWith('.yaml'))
    .map(name => {
        const contents = fs.readFileSync(name, 'utf8')
        const parsed = yaml.parse(contents)
        if (!parsed.wikilink.startsWith('https://wikipedia.org/wiki/'))
            throw Error('wrong prefix on wikilink')
        parsed.wiki_displaylink = parsed.wikilink.substring('https://'.length);
        if (!parsed.name) {
            parsed.name = parsed.wikilink.substring('https://wikipedia.org/wiki/'.length).replace(/_/g, ' ');
        }
        return parsed;
    });
allPosts.sort((a, b) => b.date.localeCompare(a.date))

/*
const svgTemplate = fs.readFileSync('src/templates/post2.svg', 'utf-8');
function writePostsSvgs(post) {
    const image_b64 = fs.readFileSync('src' + post.img).toString('base64');
    const svg = M.render(svgTemplate, {...post, image_b64});
    const svg_path = '/svgs/' + post.date + '.svg';
    post.svg_path = svg_path;
    fs.writeFileSync('./docs' + svg_path, svg);
}
allPosts.forEach(writePostsSvgs);
*/

const outerTemplate = fs.readFileSync('src/templates/outer.html', 'utf-8');
const postsTemplate = fs.readFileSync('src/templates/posts.html', 'utf-8');
const aboutTemplate = fs.readFileSync('src/templates/about.html', 'utf-8');

function renderWithOuterWrapper(innerTemplate, innerArgs) {
    const inner = M.render(innerTemplate, innerArgs);
    const outer = M.render(outerTemplate, {content: inner})
    return outer;
}

function writePosts(posts, outDir, outFilename, opt_extraHeader) {
    outDir = 'docs/' + outDir;
    const page = renderWithOuterWrapper(postsTemplate, {
            header: opt_extraHeader,
            posts
    });

    fs.mkdirSync(outDir, {recursive: true}, (err) => { if (err) throw err });

    // TODO: Split this into multiple once there's too many posts
    // (mainly for the allposts ordered by date.
    fs.writeFileSync(outDir + '/' + outFilename, page);
}

writePosts(allPosts, '.', 'index.html', 'Interesting Wikipedia Articles, Sketched')

function writePostsGroupByField(posts, fieldName) {
    const m = new Map();
    function add(post, group) {
        if (!m.has(group)) m.set(group, []);
        m.get(group).push(post);
    }
    for (const post of posts) {
        const field = post[fieldName];
        if (field instanceof Array)
            for (const f of field) add(post, f);
        else
            add(post, field);
    }

    for (const [group, posts] of m.entries()) {
        writePosts(
            posts,
            'by/' + fieldName, group + '.html',
            `by ${fieldName}: ${group}`);
    }
}

writePostsGroupByField(allPosts, 'date')
writePostsGroupByField(allPosts, 'tag')

const aboutPage = renderWithOuterWrapper(aboutTemplate);
fs.writeFileSync('docs/about.html', aboutPage);
