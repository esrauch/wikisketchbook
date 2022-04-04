const yaml = require('yaml')
const fs = require('fs')
const M = require('mustache')
const { parse } = require('path')

function recursiveLs(dir) {
    const files = fs.readdirSync(dir).map(f => `${dir}/${f}`)
    return files.flatMap(f => {
        if (fs.statSync(f).isDirectory()) {
            return recursiveLs(f)
        }
        return f;
    })
}

const individualPosts = recursiveLs('src/posts')
    .filter(name => name.endsWith('.yaml'))
    .map(name => fs.readFileSync(name, 'utf8'))
    .map(contents => yaml.parse(contents));

const comboFilePosts = yaml.parse(fs.readFileSync('src/posts.yaml', 'utf8'));

const articles =
    [...individualPosts, ...comboFilePosts]
    .map(parsed => {
        if (parsed.wikilink) {
            if (!parsed.wikilink.startsWith('https://wikipedia.org/wiki/'))
                throw Error('wrong prefix on wikilink for file ' + name);
            parsed.wiki_displaylink = parsed.wikilink.substring('https://'.length);
            parsed.wiki_displaylink = parsed.wiki_displaylink.replace('/wiki/', '/');
        }
        if (!parsed.name) {
            parsed.name = parsed.wikilink.substring('https://wikipedia.org/wiki/'.length).replace(/_/g, ' ');
        }
        if (!parsed.date) {
            parsed.date = '9997-0-0';
        }
        if (typeof parsed.text === 'string') {
            parsed.text = [parsed.text];
        }
        if (!parsed.tag) parsed.tag = 'misc';
        return parsed;
    });


articles.sort((a, b) => b.date.localeCompare(a.date))

const outerTemplate = fs.readFileSync('src/templates/outer.html', 'utf-8');
const postsTemplate = fs.readFileSync('src/templates/posts.html', 'utf-8');
const aboutTemplate = fs.readFileSync('src/templates/about.html', 'utf-8');

function renderWithOuterWrapper(innerTemplate, args) {
    const inner = M.render(innerTemplate, args);
    const outer = M.render(outerTemplate, { ...args, content: inner })
    return outer;
}

function writePosts(posts, outDir, outFilename, opts) {
    opts = opts || {};

    outDir = 'docs/' + outDir;
    const page = renderWithOuterWrapper(postsTemplate, {
        header: opts['header'],
        hide_header_links: opts['hideHeaderLinks'],
        posts
    });

    fs.mkdirSync(outDir, { recursive: true }, (err) => { if (err) throw err });

    // TODO: Split this into multiple once there's too many posts
    // for the articles ordered by date.
    fs.writeFileSync(outDir + '/' + outFilename, page);
}

const landing = yaml.parse(fs.readFileSync('src/promos.yaml', 'utf8'));
const arted = articles.filter(post => !!post.img);
const artless = articles.filter(post => !post.img);

writePosts(landing, '.', 'index.html', {hideHeaderLinks: true})
writePosts(articles, '.', 'all.html', {header: 'Curious Wiki Pages'})
writePosts(arted, '.', 'arted.html', {header: 'Art inspired by Articles'})
writePosts(artless, '.', 'artless.html', {header: 'Interesting Not-arted Articles'})
console.log(`${articles.length} posts written to index`)


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
            {header: `by ${fieldName}: ${group}`});
    }
    console.log(`${m.size} by ${fieldName} written`)
}

writePostsGroupByField(articles, 'date')
writePostsGroupByField(articles, 'tag')

const aboutPage = renderWithOuterWrapper(aboutTemplate);
fs.writeFileSync('docs/about.html', aboutPage);

console.log('done!')