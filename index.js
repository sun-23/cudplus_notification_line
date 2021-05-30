const request = require('request')
const admin = require('firebase-admin');

let chrome = {};
let puppeteer;

if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
  // running on the Vercel platform.
  chrome = require('chrome-aws-lambda');
  puppeteer = require('puppeteer-core');
} else {
  // running locally.
  puppeteer = require('puppeteer');
}

var serviceAccount = require('./service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// old not required
//var firebase = require("firebase/app");
// Add the Firebase products that you want to use
// require("firebase/firestore");
// var firebaseConfig = {
//     apiKey: "AIzaSyCVyJMSsEyHx-i1ChlWONIxs_6CgeLsQq4",
//     authDomain: "cudplus-track.firebaseapp.com",
//     projectId: "cudplus-track",
//     storageBucket: "cudplus-track.appspot.com",
//     messagingSenderId: "949437393600",
//     appId: "1:949437393600:web:373398657675c3eaff5b25"
// };
// Initialize Firebase
// firebase.initializeApp(firebaseConfig);
// var db = firebase.firestore();

const url_login = 'https://www.mycourseville.com/api/login';
var current_text = '';
var n = 0;
let browser;
let page;

async function login(){
    if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
        // running on the Vercel platform.
        browser = await puppeteer.launch({
            args: [...chrome.args, '--hide-scrollbars', '--disable-web-security'],
            defaultViewport: chrome.defaultViewport,
            executablePath: await chrome.executablePath,
            headless: true,
            ignoreHTTPSErrors: true,
        });
    } else {
        // running locally.
        browser = await puppeteer.launch({ 
            headless: true ,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                "--disable-dev-shm-usage"
            ]
        });
    }

    page = await browser.newPage();       
    await page.goto(url_login);

    await page.reload();
    await page.type('#username', 'cudplus60043');
    await page.type('#password', '1100703714322');

    await Promise.all([
        page.click('#cv-login-cvecologinbutton'),
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
    ])
    .then(console.log('login'))
    .catch(async (err) => {
        console.log('login err', err)
        await logout()
        await browser.close()
        await login()
    });

    await Promise.all([
        page.click('#cv-userhome-applist > tbody > tr:nth-child(1) > td:nth-child(1) > div > div > div.cv-userhome-apptitle > a'),
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
    ])
    .then(console.log('click cudplus'))
    .catch(async (err) => {
        console.log('login err', err)
        await logout()
        await browser.close()
        await login()
    });
    
    await page.reload();

    await Promise.all([
        page.click('#ss-header-control > a:nth-child(3)'),
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
    ])
    .then(console.log('click notiflication'))
    .catch(async (err) => {
        console.log('login err', err)
        await logout()
        await browser.close()
        await login()
    });
}

async function check(){
    await page.reload()
            .then(async () => {
                console.log('reload!');
            })
            .catch(async (err) => {
                console.log('reload error', err)
                //console.error
                await logout()
                await browser.close()
                await login()
            });
    await page
            .waitForSelector(
                '#utility-notification-index-root > section > div > ul > li:nth-child(1) > a > div.media-body.px-2.align-self-center'
            )
            .then(async () => {
                const text_all = await page.evaluate(() => {
                    return document.querySelector("#utility-notification-index-root > section > div > ul > li:nth-child(1) > a > div.media-body.px-2.align-self-center").innerText;
                });
                const text_time = await page.evaluate(() => {
                    return document.querySelector('#utility-notification-index-root > section > div > ul > li:nth-child(1) > a > div.media-body.px-2.align-self-center > div').innerText;
                })
                const final_text = text_all.substr(0, text_all.indexOf(text_time));
                console.log('final_text = '+ final_text);
                console.log('current_text = '+ current_text);
                if (final_text === current_text) {
                    console.log('not message');
                } else {
                    console.log('message');
                    send_line_notify(final_text);
                    store_data(final_text);
                    load_data();
                }
            }).catch(async (err) => {
                console.log('error no selector', err)
                //console.error
                await logout()
                await browser.close()
                await login()
            });
    //let bodyHTML = await page.evaluate(() => document.body.innerHTML);
    //console.log(bodyHTML);
}

async function logout(){
    await Promise.all([
        page.click('#ss-app-sidebar-control'),
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
    ])
    .then(console.log('click logout!'))
    .catch(async (err) => {
        console.log('logout! err', err)
        await browser.close()
    });
    //#ss-app-navigation > li:nth-child(15) > a
    await Promise.all([
        page.click('#ss-app-navigation > li:nth-child(15) > a'),
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
    ])
    .then(console.log('click logout!'))
    .catch(async (err) => {
        console.log('logout! err', err)
        await browser.close()
    });
}

async function store_data(text){
    db.collection("tmptext").doc("text").set({
        current_text: text,
    })
    .then(() => {
        console.log("Document successfully written!");
        load_data()
    })
    .catch((error) => {
        console.error("Error writing document: ", error);
    });
}

function load_data(){
    db.collection("tmptext").doc("text")
    .get().then((doc) => {
        if (doc.exists){
        var text = doc.data();
        current_text = text.current_text;
        } else {
      console.log("No such document!");
    }}).catch((error) => {
      console.log("Error getting document:", error);
    });
}

function send_line_notify(text_tmp){
    request({
        method: 'POST',
        uri: 'https://notify-api.line.me/api/notify',
        header: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
            bearer: '2gx36bVcc0NVXue50YkSeRDto6QTsurCt3DoB1neaig', //token
        },
        form: {
            message: 'cudplus notification subject '+ text_tmp +' notification click cudplus link https://cudplus.onsmart.school/utility/notifications', //ข้อความที่จะส่ง
        },
    }, (err, httpResponse, body) => {
        if (err) {
            console.log(err)
        } else {
            console.log(body)
        }
    })
    console.log('message has been sent!');
}

const main = async () => {
    await load_data()
    await login()
    await check()
    console.log('hellowkdkd');
    console.log('n: ',n);
    n = n + 1;
    setInterval(async () => {
        await check() 
        console.log('n: ',n);
        n = n + 1;
    },5000)
}
main();
