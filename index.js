function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time)
    });
}

//var myArgs = process.argv.slice(2);
// const UF = myArgs[0];
// const CITY = myArgs[1];

const puppeteer = require('puppeteer');
const fs = require('fs');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const bodyParser = require('body-parser');

// crio um servidor express
const app = express();

// aplico configurações para dentro do servidor express, adicionando middlewares (body-parser, morgan, cors)
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

// app.listen(3000, () => console.log('Express started at http://localhost:3000'));
var porta = process.env.PORT || 8080;
app.listen(porta);

// criação de rota que será acessada utilizando o método HTTP GET/
// http://localhost:3000/
app.get(`/inep`, (req, res) => {
    
    (async () => {
        let UF = req.query.UF;//'MINAS GERAIS';
        let CITY = req.query.CITY;//'BELO HORIZONTE';   

        const URL = 'https://inepdata.inep.gov.br/analytics/saw.dll?Dashboard&NQUser=inepdata&NQPassword=Inep2014&PortalPath=%2Fshared%2FPainel%20Educacional%2F_portal%2FPainel%20Municipal';
        const SELETOR_DROP_1 = 'img[src="/analyticsRes/res/s_InepdataPainelMunicipal/master/selectdropdown_ena.png"]';

        //const browser = await puppeteer.launch({headless: false});
        const browser = await puppeteer.launch({
            //headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
            ],
          });
        const page = await browser.newPage();
        await page.goto(URL);
        await page.waitForNavigation();
        console.log('Page URL:', page.url());

        /* PREENCHER DADOS */

        // #UF * 1- click dropdown, 2- click item    
        console.log('CLICK DROP 1');
        await page.$eval(SELETOR_DROP_1, el => el.click());
        
        console.log(`CLICK ITEM ${UF}`);
        await page.$eval(`div[title="${UF}"]`, el => el.click());

        await delay(2210);

        // #CITY * 1- click dropdown, 2- click item
        console.log('CLICK DROP 2');
        await page.evaluate(() => { document.querySelectorAll('.promptDropDownButton')[1].click(); }
        );

        await delay(2650);
        console.log(`CLICK ${CITY}`);
        await page.$eval(`div.promptMenuOption[title="${CITY}"]`, _el => _el.click());

        await delay(2000);
        
        // # RESULTADOS (Exibir Resultados)
        console.log('CLICK Exibir Resultados');
        const [link] = await page.$x("//a[contains(., 'Exibir Resultados')]");
        if (link) {
            await link.click();
        }

        await page.waitForNavigation();
        console.log('New Page URL:', page.url());

        await delay(3500);

        /* RASPAR DADOS */
        const data = await page.evaluate(() => Array.from(document.querySelectorAll('.PTChildPivotTable table tr td')).map(el => el.innerText)
        );

        await delay(1535);

        // Dados da tela
        //console.log(data);
        //fs.writeFile('./output.json', JSON.stringify(data), err => err ? console.log(err) : null);

        await page.screenshot({ path: 'output.png' });
        await browser.close();

        //return JSON.stringify(data);

        let info = {
            'QUADRO DE REFERÊNCIA' :{
                'Cidade': data[0],
                'Estado': data[1],
                'Rede Municipal (RM)': {
                    'Escolas': data[9],
                    'Matrículas': data[10]
                },
                'Rede Estadual situada no seu município (REM)': {
                    'Escolas': data[12],
                    'Matrículas': data[13]
                }
            }
        }; 
    
        for(i = 0; i <= data.length; i++){
            
            let arr = {}
            let position = 24;
    
            const SECTION = [
                'Matrículas',
                'Total de Estudantes Incluídos',
                'Taxa de Aprovação (%)',
                'Taxa de Abandono (%)',
                'Média Estudantes por Turma',
                'Matrículas em Tempo Integral',
                'Taxa de Reprovação (%)',
                'Taxa de Distorção Idade-série (%)'
            ];
    
            for( let sect = 0; sect <= SECTION.length; sect ++){            
                if( data[i] == SECTION[sect] && SECTION[sect] !== undefined ){
                    
                    for(year = 1; year <=5; year++){
                        
                        let year_line = `${year}_ANO`;
    
                        arr[year_line] = { 
                            '2017':{
                                'RM': data[i+position],
                                'REM': data[i+position+1]
                            },
                            '2018':{
                                'RM': data[i+position+2],
                                'REM': data[i+position+3]
                            },
                            '2019':{
                                'RM': data[i+position+4],
                                'REM': data[i+position+5]
                            } 
                        };
    
                        position += 8;
                        
                    }
                    info[ SECTION[sect] ] = arr;
                }
            }            
        }        

        return res.json({ info });

    // })().then( result => {
    //     console.log(result);        
    });

});
  