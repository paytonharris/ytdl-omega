import express from 'express';
import Joi from 'joi';
import { queueUpPlaylistOrVideoForDownload } from './addEntries';
import { getVideoIncompleteCodesFromDB } from './db';
var app = express();
var port = process.env.PORT || 5312;
var router = express.Router();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const codeSchema = Joi.object({
  code: Joi.string().required(),
  priority: Joi.number().positive()
})


router.get('/', function(req, res) {
  res.send('Welcome to YTDL-OMEGA API\nPost a playlist code or video code like { code: <code> } to /queue');   
});

router.get('/queue', async (req, res) => {
  try {
    const data = await getVideoIncompleteCodesFromDB(100)
  
    res.json({
      data
     });
  }
  catch (error) {
    console.error(error)
    res.send("something went wrong.")
  }
});
 
router.post('/queue', async (req, res) => {
  var body
  try {
    body = codeSchema.validate(req.body);

    if (body.error) {
      throw new Error("Invalid parameters");
    }

    const params = {
      code: body.value.code,
      priority: body.value.priority || 100,
    }
    
    queueUpPlaylistOrVideoForDownload(params.code, params.priority);

    return res.send('Success');
  } catch (error) {
    res.statusCode = 400;
    return res.send(`${body?.error || "unknown error"}`);
  }
});

app.use('/api', router);

app.listen(port, () =>
  console.log(`Listening on port ${port}`),
);
