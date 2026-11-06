// Pure calculations shared by PixInsight and the Node test runner.
function chooseReference(channels) {
   if (!channels || channels.length < 2 || channels.length > 4)
      throw new Error("Select two to four channels.");
   var order = { L: 0, R: 1, G: 2, B: 3 };
   var best = null;
   var seen = {};
   for (var i = 0; i < channels.length; ++i) {
      var row = channels[i];
      if (!(row.id in order) || seen[row.id] || !isFinite(row.median))
         throw new Error("Invalid channel or median.");
      seen[row.id] = true;
      if (best === null || row.median < best.median ||
          (row.median === best.median && order[row.id] < order[best.id]))
         best = row;
   }
   return best.id;
}

function computeWeights(channels, shares) {
   if (!channels || channels.length < 2 || channels.length > 4)
      throw new Error("Select two to four channels.");
   var groups = {};
   var groupNames = [];
   var seen = {};
   for (var i = 0; i < channels.length; ++i) {
      var row = channels[i];
      if (seen[row.id] || !row.group || !isFinite(row.noise) || row.noise <= 0)
         throw new Error("Invalid channel, group, or noise value.");
      seen[row.id] = true;
      if (!Object.prototype.hasOwnProperty.call(groups, row.group)) {
         groups[row.group] = [];
         groupNames.push(row.group);
      }
      groups[row.group].push(row);
   }
   if (groupNames.length > 1) {
      if (!shares) throw new Error("Group shares must sum to 100%.");
      var shareSum = 0;
      for (var g = 0; g < groupNames.length; ++g) {
         var share = shares[groupNames[g]];
         if (!isFinite(share) || share < 0 || share > 1)
            throw new Error("Invalid group share.");
         shareSum += share;
      }
      if (Math.abs(shareSum - 1) > 1e-9)
         throw new Error("Group shares must sum to 100%.");
   }
   var result = [];
   for (var j = 0; j < channels.length; ++j) {
      var channel = channels[j];
      var members = groups[channel.group];
      var minNoise = members[0].noise;
      for (var k = 1; k < members.length; ++k)
         minNoise = Math.min(minNoise, members[k].noise);
      var denominator = 0;
      for (var m = 0; m < members.length; ++m)
         denominator += Math.pow(minNoise / members[m].noise, 2);
      var fraction = Math.pow(minNoise / channel.noise, 2) / denominator;
      result.push({
         id: channel.id,
         group: channel.group,
         noise: channel.noise,
         weight: fraction * (groupNames.length === 1 ? 1 : shares[channel.group])
      });
   }
   return result;
}

if (typeof module !== "undefined" && module.exports)
   module.exports = { chooseReference: chooseReference, computeWeights: computeWeights };
